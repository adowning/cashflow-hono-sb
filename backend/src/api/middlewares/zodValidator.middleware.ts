import { HTTPException } from "hono/http-exception";
import { fromZodError } from "zod-validation-error";

import type { Context, Env, MiddlewareHandler, TypedResponse, ValidationTargets } from "hono";
import { validator } from "hono/validator";
import type { ZodError, ZodSchema, z } from "zod";

// biome-ignore lint/complexity/noBannedTypes: <explanation>
export type Hook<I, O, E extends Env, P extends string> = (
	result: { success: true; data: O } | { success: false; error: ZodError<any>; data: I },
	c: Context<E, P>,
	// biome-ignore lint/suspicious/noConfusingVoidType: <explanation>
) => Response | Promise<Response> | void | Promise<Response | void> | TypedResponse<any>;

type HasUndefined<T> = undefined extends T ? true : false;

export const zValidator = <
	T extends ZodSchema,
	Target extends keyof ValidationTargets,
	E extends Env,
	P extends string,
	I = z.input<T>,
	O = z.output<T>,
>(
	target: Target,
	schema: T,
	hook?: Hook<I, O, E, P>,
): MiddlewareHandler<E, P, { in: { [K in Target]: I }; out: { [K in Target]: O } }> =>
	validator(target, async (value, c) => {
		const result = await schema.safeParseAsync(value);

		if (hook) {
			const hookResult = hook(
				result.success
					? { success: true as const, data: result.data as O }
					: {
							success: false as const,
							error: result.error as ZodError<any>,
							data: value as I,
						},
				c,
			);
			if (hookResult) {
				if (hookResult instanceof Response || hookResult instanceof Promise) {
					return hookResult;
				}
				if ("response" in hookResult) {
					return hookResult.response;
				}
			}
		}

		if (!result.success) {
			// @ts-ignore - fromZodError type mismatch due to ZodError versioning
			const validationError = fromZodError(result.error);

			return c.json(
				{
					message: validationError.message,
					errors: validationError.details,
				},
				400,
			);
		}

		const data = result.data as z.infer<T>;
		return data;
	}) as MiddlewareHandler<E, P, { in: { [K in Target]: I }; out: { [K in Target]: O } }>;
