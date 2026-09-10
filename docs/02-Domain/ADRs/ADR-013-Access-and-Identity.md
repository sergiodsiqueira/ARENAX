# Acesso e Identidade

## Status
Aceita.

## Contexto
Cliente representa um cadastro operacional que pode assumir o papel de Responsável
em uma Sessão. A plataforma também precisa identificar operadores autorizados, sem
misturar credenciais e permissões ao contexto de Clientes.

## Decisão
- Acesso e Identidade é um contexto de suporte separado.
- `Usuario` representa quem pode acessar a plataforma e não exige vínculo com `Cliente` no MVP.
- O esquema físico usa as tabelas `usuarios` e `acessos`.
- Senhas são armazenadas somente como hash Argon2id.
- Cada login cria um token opaco; somente o hash do token é persistido em `acessos`.
- O token é transportado em cookie HttpOnly e SameSite. `Secure` é obrigatório em produção.
- Papéis iniciais: `proprietario`, `administrador` e `operador`.
- Estados iniciais: `ativo`, `bloqueado` e `desativado`.
- Logout revoga o Acesso no servidor.
- Consultas e intenções operacionais de Sessão exigem Usuário ativo.
- CRUD de Clientes exige apenas Usuário ativo. Cadastro estrutural de Espaços e
  Equipamentos exige `proprietario` ou `administrador`.
- Eventos físicos de AX Device não usam a autenticação humana e terão proteção
  própria de dispositivo.
- `proprietario` pode cadastrar e administrar qualquer papel.
- `administrador` pode cadastrar e administrar `administrador` e `operador`, mas
  não pode criar, promover, alterar ou desativar um `proprietario`.
- Nenhum Usuário pode bloquear ou desativar o próprio acesso.
- O último `proprietario` ativo não pode ser desativado, bloqueado ou movido para
  outro papel.
- Alteração de senha, bloqueio e desativação revogam todos os Acessos ativos do
  Usuário afetado.
- Recuperação local de senha usa token opaco temporário, de uso único, persistido
  somente como hash em `tokens_redefinicao_senha`. No MVP local, a API pode expor
  a URL de redefinição para teste; em produção, a mesma intenção deve enviar as
  instruções por e-mail sem revelar se o Usuário existe.

## Consequências
Regras de autorização permanecem no backend. Tokens não são armazenados em
`localStorage`. MFA e vínculo opcional com Cliente são evoluções posteriores e
não alteram o significado de Sessão no Core Domain.
