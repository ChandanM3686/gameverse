export const TITLE_MAX_LENGTH = 80

export function truncateTitle(title: string) {
  return title.length > TITLE_MAX_LENGTH
    ? `${title.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`
    : title
}
