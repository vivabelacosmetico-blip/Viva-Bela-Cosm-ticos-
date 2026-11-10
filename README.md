# Viva Bela Cosméticos — base para publicação

Este pacote transforma o protótipo visual em uma base de loja com API Node, banco Supabase e início de integração Mercado Pago Checkout Pro (Orders API).

## Importante antes de vender
- O `public/index.html` é o protótipo atual. Ainda precisa ser ligado às rotas `/api/products` e `/api/checkout` no código da interface.
- O webhook está como ponto de partida: antes de produção, implementar validação criptográfica `x-signature` conforme a documentação do Mercado Pago e testar os eventos.
- A tabela de pedidos guarda dados pessoais; configurar políticas, acesso e privacidade antes de abrir ao público.
- Frete ainda não está integrado; combinar regra de frete/retirada antes de cobrar.
- Não use credenciais de teste para cobrar clientes.

## Serviços necessários
1. Criar projeto Supabase e executar `database.sql` no SQL Editor.
2. Hospedar este projeto Node em um serviço que mantenha servidor ativo (ex.: Render/Railway) e configurar as variáveis de ambiente de `.env.example` no painel do serviço.
3. Criar aplicação no Mercado Pago Developers, pegar Access Token de produção e guardá-lo como variável secreta `MERCADOPAGO_ACCESS_TOKEN` no servidor. Nunca enviar token por mensagem nem colocá-lo no navegador.
4. Configurar Webhook de Orders para `https://SEU-DOMINIO/api/mercadopago/webhook`, com HTTPS, e concluir validação de assinatura antes de produção.
5. Ligar domínio próprio e testar compra de ponta a ponta em ambiente de teste antes de ativar produção.

## Rodar localmente
`npm install` e depois `npm start`, após preencher as variáveis de ambiente.
