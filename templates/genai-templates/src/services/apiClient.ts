type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type ApiRequestOptions = {
  method?: RequestMethod;
  body?: BodyInit | null;
  headers?: HeadersInit;
  signal?: AbortSignal;
};

export async function apiClient<TResponse>(
  input: string,
  { method = 'GET', body = null, headers, signal }: ApiRequestOptions = {},
): Promise<TResponse> {
  const response = await fetch(input, {
    method,
    body,
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as TResponse;
}
