export function parsePagination(query, { defaultPageSize = 10, maxPageSize = 50 } = {}) {
  let page = Number.parseInt(query.page, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  let pageSize = Number.parseInt(query.pageSize, 10);
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = defaultPageSize;
  pageSize = Math.min(pageSize, maxPageSize);
  return { page, pageSize, skip: (page - 1) * pageSize, limit: pageSize };
}

export function pageResult(items, total, { page, pageSize }) {
  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
