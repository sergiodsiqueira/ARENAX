# Backend

## Stack
Python, FastAPI, SQLAlchemy 2, Alembic, PostgreSQL, Redis e testes automatizados.

## Organização
```text
apps/api/src/
  domain/
    session/
    space/
    person/
    equipment/
    moment/
  application/
  infrastructure/
  api/
tests/
```

## Regras
- Domain Layer não importa FastAPI, SQLAlchemy ou Redis.
- Conflito de horário não fica no frontend.
- DTOs não substituem entidades.
- Repositórios são portas; SQLAlchemy é implementação.
- Transações delimitam casos de uso.
- Eventos são publicados após operações consistentes.
