export interface PaginationParams {
  page: number;
  per_page: number;
}

export type PaginationQuery = { page?: string; per_page?: string };

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export function getPaginationParams(query: PaginationQuery): PaginationParams {
  const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
  const per_page = Math.min(
    100,
    Math.max(1, parseInt(query.per_page || '20', 10) || 20),
  );
  return { page, per_page };
}

export function paginate<T>(
  data: T[],
  total: number,
  params: PaginationParams,
): PaginatedResult<T> {
  return {
    data,
    meta: {
      page: params.page,
      per_page: params.per_page,
      total,
      total_pages: Math.ceil(total / params.per_page),
    },
  };
}
