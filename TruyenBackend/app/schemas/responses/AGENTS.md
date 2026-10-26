# Safe output

Typed explicit outputs and GenericResponse[T]. Never output hashes/secrets, unrestricted ORM __dict__, raw errors or full chapter bodies in lists. Distinguish chapter metadata DTO from content DTO. Validation/HTTP/domain/unexpected errors follow the same documented envelope. Test the actual HTTP JSON, not only Pydantic construction.
