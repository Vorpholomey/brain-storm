import pino from 'pino';

export function createLogger(bindings?: object): pino.Logger {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return pino(
    bindings ?? {},
    isDevelopment
      ? pino.transport({
          target: 'pino-pretty',
          options: {
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
          },
        })
      : undefined,
  );
}
