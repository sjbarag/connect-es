// Copyright 2021-2022 Buf Technologies, Inc.
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

import type { CallOptions } from "@bufbuild/connect-core";
import {
  Code,
  ConnectError,
  createCallbackClient,
  createPromiseClient,
} from "@bufbuild/connect-node";
import { TestService } from "../gen/grpc/testing/test_connectweb.js";
import { createTestServers } from "../helpers/testserver.js";

fdescribe("cancellation", function () {
  const servers = createTestServers();
  beforeAll(async () => await servers.start());

  function expectError(err: unknown) {
    expect(err).toBeInstanceOf(ConnectError);
    if (err instanceof ConnectError) {
      expect(err.code === Code.Canceled).toBeTrue();
    }
  }

  servers.describeTransportsOnly(
    [
      "@bufbuild/connect-node (gRPC, binary, https) against connect-go (h1)",
      // "@bufbuild/connect-node (gRPC, binary, http2) against connect-go (h1)",
    ],
    (transport) => {
      const request = {};
      const abort = new AbortController();
      abort.abort();
      const options: Readonly<CallOptions> = {
        signal: abort.signal,
      };

      fit("cancel unary with promise client", async function () {
        const client = createPromiseClient(TestService, transport());

        try {
          await client.unaryCall(request, options);
        } catch (e) {
          expectError(e);
        }
      });
      xit("cancel unary with callback client", function (done) {
        const client = createCallbackClient(TestService, transport());
        const callback = (e: ConnectError | undefined) => {
          expectError(e);
          done();
        };
        try {
          client.unaryCall(request, callback, options);
        } catch (e) {
          expectError(e);
        }
        done();
      });
    }
  );

  afterAll(async () => await servers.stop());
});
