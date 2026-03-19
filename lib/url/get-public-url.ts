export function getPublicAppUrl(request: Request): string {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost ?? request.headers.get('host');
  const forwardedProto = request.headers.get('x-forwarded-proto');

  if (host) {
    const protocol = forwardedProto ?? requestUrl.protocol.replace(':', '');
    return `${protocol}://${host}`;
  }

  return (process.env.NEXT_PUBLIC_APP_URL ?? requestUrl.origin).replace(/\/$/, '');
}
