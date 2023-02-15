// Copyright 2021-2023 Buf Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { createHandlers } from "@bufbuild/connect-node";
import { ElizaService } from "./gen/eliza_connectweb.js";
import type {
  SayRequest,
  IntroduceRequest,
  ConverseRequest,
} from "./gen/eliza_pb.js";

import * as Http2 from "http2";
import Hapi from "@hapi/hapi";
import Inert from "@hapi/inert";
import * as esbuild from "esbuild";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const handlers = createHandlers(ElizaService, {
  say(req: SayRequest) {
    return {
      sentence: `You said ${req.sentence}`,
    };
  },
  async *introduce(req: IntroduceRequest) {
    yield { sentence: `Hi ${req.name}, I'm eliza` };
    await delay(250);
    yield {
      sentence: `Before we begin, ${req.name}, let me tell you something about myself.`,
    };
    await delay(150);
    yield { sentence: `I'm a Rogerian psychotherapist.` };
    await delay(150);
    yield { sentence: `How are you feeling today?` };
  },
  async *converse(reqs: AsyncIterable<ConverseRequest>) {
    for await (const req of reqs) {
      yield {
        sentence: `You said ${req.sentence}`,
      };
    }
  },
});

const start = async () => {
  const server = new Hapi.Server({
    listener: Http2.createServer(),
    port: 8080,
    host: "localhost",
    debug: { request: ["info"] },
  });

  await server.register(Inert);

  server.route({
    method: "GET",
    path: "/{any*}",
    handler: {
      directory: {
        path: "www",
      },
    },
  });

  for (const handler of handlers) {
    server.route({
      method: "POST",
      path: handler.requestPath,
      options: {
        payload: {
          parse: false,
          // output: "stream",
        },
      },
      handler: async (request, h) => {
        console.log("in the handler for", request.path);
        const { req, res } = request.raw;
        // const h2sr = new Http2.Http2ServerResponse(res);
        handler(req, res);
        const response = h
          .response(res)
          .type("application/connect+proto")
          .header("Content-Type", "application/connect+proto");
        // console.log("response:", response);
        return response;
      },
    });
  }

  await server.start();
  console.log("Server running on %s", server.info.uri);
  console.log("Run `npm run client` for a terminal client.");
};

process.on("unhandledRejection", (err) => {
  console.log(err);
  process.exit(1);
});

void esbuild.build({
  entryPoints: ["src/webclient.ts"],
  bundle: true,
  outdir: "www",
});

start();
