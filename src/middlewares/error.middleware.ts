import {Request, Response, NextFunction, ErrorRequestHandler} from 'express';
import {ZodError} from 'zod';

export const errorHandler: ErrorRequestHandler = (
    err: Error & { status?: number },
    _req: Request,
    res: Response,
    _next: NextFunction
) => {
    if (err instanceof ZodError) {
        return res.status(400).json({
            error: "Validation failed",
            details: err.issues.map(issue => ({
                field: issue.path.join('.'),
                message: issue.message
            }))
        });
        return;
    }

    const status = err.status ?? 500;
    if (status >= 500) {
        console.error(err);
    }

    res.status(status).json({
        error: status >= 500 ? "Internal server error" : err.message
    });
}