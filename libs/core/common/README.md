# core-common

Cross-cutting infrastructure for the API: DB module, health checks, decorators, pagination, timeout util. Per ADR-0002 every bounded context lives in `libs/core/<context>/`; this is the documented exception that holds infra shared by all contexts.
