export class AppError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly code: string,
        readonly details?: Record<string, unknown>,
    ) {
        super(message);
        this.name = "AppError";
    }
}

export function isUniqueViolation(error: unknown): boolean {
    if (typeof error !== "object" || error === null || !("driverError" in error)) {
        return false;
    }
    const driverError = (error as { driverError?: { code?: string } }).driverError;
    return driverError?.code === "23505";
}
