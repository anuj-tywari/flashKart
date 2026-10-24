import { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError) {
        res.status(400).json({
            error: "Validation failed",
            code: "VALIDATION_FAILED",
            details: err.issues.map((issue) => ({
                field: issue.path.join("."),
                message: issue.message,
            })),
        });
        return;
    }

    if (err instanceof AppError) {
        res.status(err.status).json({
            error: err.message,
            code: err.code,
            ...(err.details ? { details: err.details } : {}),
        });
        return;
    }

    const status = typeof err === "object" && err && "status" in err && typeof err.status === "number"
        ? err.status
        : 500;
    if (status >= 500) {
        console.error(err);
    }
    const message = status >= 500 || !(err instanceof Error) ? "Internal server error" : err.message;
    res.status(status).json({ error: message, code: status >= 500 ? "INTERNAL" : "BAD_REQUEST" });
};
