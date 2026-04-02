type LogFields = Record<string, string | number | boolean | undefined>;

export function logInfo(message: string, fields?: LogFields) {
  console.log(
    JSON.stringify({ level: "info", msg: message, ...fields, t: Date.now() })
  );
}

export function logWarn(message: string, fields?: LogFields) {
  console.warn(
    JSON.stringify({ level: "warn", msg: message, ...fields, t: Date.now() })
  );
}

export function logError(message: string, fields?: LogFields) {
  console.error(
    JSON.stringify({ level: "error", msg: message, ...fields, t: Date.now() })
  );
}
