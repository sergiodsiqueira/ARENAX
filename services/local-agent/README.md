# ARENAX Local Agent

Componente Windows executado fora do Docker para operações que exigem acesso ao
host. Na v1 ele abre o seletor nativo de pastas e aplica a mudança do diretório de
Replays sem expor o Docker ao navegador.

Durante a instalação da ARENAX, execute `install.ps1` uma única vez como
Administrador. O instalador gera o segredo, limita a porta ao perfil de rede
privada, registra a inicialização no login e atualiza a API. Depois disso, toda a
operação é feita pela tela de Configurações.

O agente também lista as interfaces IPv4 ativas da máquina para que um
Administrador escolha, dentro da ARENAX, o endereço de rede usado pelos AX Devices.
