class DomainError(Exception):
    """Base error for a rejected business intention."""


class InvalidSessionTransition(DomainError):
    pass


class SessionConflict(DomainError):
    pass


class EntityNotFound(DomainError):
    pass


class InvalidCredentials(DomainError):
    """Authentication failed without revealing which credential was invalid."""


class InvalidAccess(DomainError):
    """An access token is absent, expired, revoked or unknown."""


class ForbiddenAccess(DomainError):
    """The authenticated User does not have the required role."""
