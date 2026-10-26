# DTO and envelope rules

Pydantic 2; separate requests/responses and explicitly expose output fields. GenericResponse wire shape is success/message/error_code/data, identical to actual HTTP and OpenAPI. Dates use ISO 8601 with timezone; display formatting remains client-side. Use from_attributes for approved ORM conversions. Pagination API page starts at 1, default size 50/max 100; storage position remains zero-based.
