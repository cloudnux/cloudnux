
import { RouterInstance } from '@cloudnux/local-cloud-provider';
import { httpHandler, scheduleHandler, eventBrokerHandler } from "@cloudnux/cloud-sdk";
import "@cloudnux/local-cloud-provider/schedule-plugin";
import "@cloudnux/local-cloud-provider/queue-plugin";

import * as src from "/Users/malphonce/Projects/cloudnux/cloudnux/example/packages/modules/module1/src/index.ts";

async function entries(app: RouterInstance) {
        app.route({
          method: "POST" as any,
          url: `/http/identity/token`,
          module : "module1",
          handler: async (request, reply) => {
              await httpHandler(src["token"], request, reply); 
          }
    });
        app.route({
          method: "DELETE" as any,
          url: `/http/identity/revoke`,
          module : "module1",
          handler: async (request, reply) => {
              await httpHandler(src["revoke"], request, reply); 
          }
    });
}

export default entries;