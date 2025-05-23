import { HttpFunctionContext } from "packages/sdk/src";

export function getMe(ctx: HttpFunctionContext) {
    ctx.success({
        message: 'Hello from identity -> getMe'
    });
}

export function setMe(ctx: HttpFunctionContext) {
    console.info('getMe from identity -> setMe', ctx.params, ctx.request.body);
    ctx.error({
        msg: 'Error from module2 -> SetMe'
    });
}