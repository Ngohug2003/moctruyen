# Admin controller rules

Privileged endpoints for catalog administration and book imports. Require authenticated identity; validate incoming multipart uploads, bounds and file types before delegating to services. Return standard GenericResponse envelopes.
