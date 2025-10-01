
import { RouterInstance } from '@cloudnux/local-cloud-provider';
import { httpHandler, scheduleHandler, eventBrokerHandler } from "@cloudnux/cloud-sdk";
import "@cloudnux/local-cloud-provider/schedule-plugin";
import "@cloudnux/local-cloud-provider/queue-plugin";

import * as src from "/Users/malphonce/Projects/cloudnux/cloudnux/example/packages/modules/identity/src/index.ts";

async function entries(app: RouterInstance) {
        app.route({
          method: "GET" as any,
          url: `/http/v1/me`,
          module : "identity",
          handler: async (request, reply) => {
              await httpHandler(src["getMe"], request, reply); 
          }
    });
        app.route({
          method: "POST" as any,
          url: `/http/v1/me`,
          module : "identity",
          handler: async (request, reply) => {
              await httpHandler(src["setMe"], request, reply); 
          }
    });
      app.scheduler.addJob({
       name: 'run-schedule',
       cronExpression: 'rate(1 minute)',
       module : "identity",
       handler: async (job, execution) => {
          return scheduleHandler(src["runSchedule"], job,execution)
       }});
         app.queues.addQueue("event-trigger-queue",
          (msg) => eventBrokerHandler(src["runEvent"], msg),
          "identity"
          );
      app.scheduler.addJob({
       name: 'scheduled-task',
       cronExpression: 'rate(1 hour)',
       module : "identity",
       handler: async (job, execution) => {
          return scheduleHandler(src["runScheduledTask"], job,execution)
       }});
}

export default entries;