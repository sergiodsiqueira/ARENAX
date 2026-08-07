class DomainError(Exception):
    """Base error for a rejected business intention."""


class InvalidSessionTransition(DomainError):
    pass


class SessionConflict(DomainError):
    pass


class EntityNotFound(DomainError):
    pass

