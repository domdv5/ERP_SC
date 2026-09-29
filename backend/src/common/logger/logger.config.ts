import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DestinationStream } from 'pino';
import pino from 'pino';
import pinoPretty from 'pino-pretty';
import pinoRoll from 'pino-roll';
import type { Params } from 'nestjs-pino';
import type { JwtPayload } from '@/common/types';

type RequestWithOptionalUser = IncomingMessage & { user?: JwtPayload };

const SSE_STREAM_PATH = '/system/status/stream';
const LOG_FILE_BASE = join(process.cwd(), 'logs', 'app');

// El SSE manda el JWT en ?token= porque EventSource no puede usar headers
const sanitizeUrl = (url = ''): string =>
  url.replace(/([?&]token=)[^&]*/gi, '$1[REDACTED]');

const resolveReqId = (req: IncomingMessage, res: ServerResponse): string => {
  const header = req.headers['x-request-id'];
  const id = (Array.isArray(header) ? header[0] : header) || randomUUID();
  res.setHeader('x-request-id', id);
  return id;
};

export interface LoggerOptions {
  nodeEnv?: string;
  logLevel?: string;
  logHttpConsole?: string;
}

// La línea automática de pino-http es la única con `res` y `responseTime` a la vez
const isHttpRequestLine = (line: string): boolean => {
  if (!line.includes('"responseTime"')) return false;
  try {
    const log = JSON.parse(line) as Record<string, unknown>;
    return 'res' in log && 'responseTime' in log;
  } catch {
    return false;
  }
};

const withoutHttpRequestLines = (
  target: DestinationStream,
): DestinationStream => ({
  write: (line: string) => {
    if (!isHttpRequestLine(line)) target.write(line);
  },
});

export async function buildLoggerParams({
  nodeEnv,
  logLevel,
  logHttpConsole,
}: LoggerOptions): Promise<Params> {
  const isProduction = nodeEnv === 'production';
  const level = logLevel || (isProduction ? 'info' : 'debug');
  // Solo el valor exacto "false" oculta las líneas de request en la terminal
  const httpConsoleEnabled = logHttpConsole?.trim().toLowerCase() !== 'false';

  const consoleStream: DestinationStream = isProduction
    ? pino.destination(1)
    : pinoPretty({
        colorize: true,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
        ignore: 'pid,hostname',
      });

  const fileStream = await pinoRoll({
    file: LOG_FILE_BASE,
    extension: '.log',
    frequency: 'daily',
    dateFormat: 'yyyy-MM-dd',
    mkdir: true,
    limit: { count: 14 },
  });
  process.once('exit', () => {
    try {
      fileStream.flushSync();
    } catch {
      // el stream ya estaba cerrado o vacío
    }
  });

  const streams = pino.multistream([
    {
      level,
      stream: httpConsoleEnabled
        ? consoleStream
        : withoutHttpRequestLines(consoleStream),
    },
    { level, stream: fileStream },
  ]);

  return {
    pinoHttp: [
      {
        level,
        genReqId: resolveReqId,
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers["set-cookie"]',
            'req.body.password',
            '*.password',
            '*.token',
            '*.accessToken',
            '*.access_token',
          ],
          censor: '[REDACTED]',
        },
        serializers: {
          req: (req: { id: string; method: string; url: string }) => ({
            id: req.id,
            method: req.method,
            url: sanitizeUrl(req.url),
          }),
          res: (res: { statusCode: number }) => ({
            statusCode: res.statusCode,
          }),
        },
        autoLogging: {
          ignore: (req: IncomingMessage) =>
            (req.url ?? '').startsWith(SSE_STREAM_PATH),
        },
        customLogLevel: (_req, res, err) => {
          if (err || res.statusCode >= 500) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },
        customSuccessMessage: (req, res, responseTime) =>
          `${req.method} ${sanitizeUrl(req.url)} ${res.statusCode} ${responseTime}ms`,
        customErrorMessage: (req, res) =>
          `${req.method} ${sanitizeUrl(req.url)} ${res.statusCode}`,
        // JwtAuthGuard corre después del middleware: el usuario se lee al cerrar la request
        customProps: (req: RequestWithOptionalUser) =>
          req.user
            ? { user: { id: req.user.sub, username: req.user.username } }
            : {},
      },
      streams,
    ],
  };
}
