export async function fetcher(url: string) {
  const response = await fetch(url);
  return response.json();
}
