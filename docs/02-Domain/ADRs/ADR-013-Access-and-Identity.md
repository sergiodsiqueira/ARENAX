# Acesso e Identidade

## Status
Aceita.

## Contexto
Pessoa representa um cadastro operacional que pode assumir o papel de Responsável
em uma Sessão. A plataforma também precisa identificar operadores autorizados, sem
misturar credenciais e permissões ao contexto de Pessoas.

## Decisão
- Acesso e Identidade é um contexto de suporte separado.
- `Usuario` representa quem pode acessar a plataforma e não exige vínculo com `Pessoa` no MVP.
- O esquema físico usa as tabelas `usuarios` e `acessos`.
- Senhas são armazenadas somente como hash Argon2id.
- Cada login cria um token opaco; somente o hash do token é persistido em `acessos`.
- O token é transportado em cookie HttpOnly e SameSite. `Secure` é obrigatório em produção.
- Papéis iniciais: `proprietario`, `administrador` e `operador`.
- Estados iniciais: `ativo`, `bloqueado` e `desativado`.
- Logout revoga o Acesso no servidor.
- Consultas e intenções operacionais de Sessão exigem Usuário ativo.
- Cadastro estrutural de Pessoas, Espaços e Equipamentos exige `proprietario` ou
  `administrador`.
- Eventos físicos de AX Device não usam a autenticação humana e terão proteção
  própria de dispositivo.

## Consequências
Regras de autorização permanecem no backend. Tokens não são armazenados em
`localStorage`. Recuperação de senha, MFA e vínculo opcional com Pessoa são evoluções
posteriores e não alteram o significado de Sessão no Core Domain.
