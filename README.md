# EstudeVet v11

Plataforma de estudos para Medicina Veterinaria. Reconstrucao completa da
camada de dados e das telas.

## Como comecar

Se e a primeira vez, siga o **COMECE-AQUI.md** - ele te leva do banco vazio
ate o app rodando.

### Resumo

```bash
npm install
npm run verificar   # tipos + testes + auditoria
npm run dev
```

Nao precisa configurar variavel de ambiente: a URL e a chave publica do
Supabase estao embutidas em `src/lib/supabase/config.ts`. So a `service_role`
e secreta, e ela serve apenas aos scripts locais de migracao.

No Supabase novo, rode em ordem: `0001` a `0005` e depois `seed.sql`.

Depois disso, siga o **ROTEIRO-DE-VIRADA.md** de ponta a ponta antes de
liberar para alguem.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run verificar` | tipos, testes e auditoria - rode antes de todo commit |
| `npm run checar` | so os tipos |
| `npm run testar` | testes de embaralhamento, streak, anel, grafico e medalhas |
| `npm run auditar` | RLS, rotas quebradas, erro/estado vazio, emoji, cor solta |
| `npm run migrar:conferir` | migracao do legado em dry-run |
| `npm run migrar:executar` | migracao de verdade |
| `npm run questoes:validar` | confere um lote novo de questoes, sem banco |
| `npm run questoes:importar` | importa o lote (dry-run por padrao) |

## As quatro regras que sustentam o projeto

**1. Nenhum componente fala com o banco.**
Tela chama repositorio, repositorio chama banco. Server Component pega o
client e **injeta**: `listarComAcesso(sb)`. A auditoria reprova quem furar
isso.

**2. O gabarito nao existe no cliente.**
`alternativas.correta` tem a leitura revogada. Quem corrige e
`registrar_resposta()`, no servidor, e o gabarito so volta depois de a
resposta estar gravada. O tipo `AlternativaVisivel` nem tem o campo.

**3. Nada que vira nota entra por insert direto.**
`respostas`, `atividade_diaria` e `usuario_conquistas` so recebem escrita de
funcao `security definer`. Streak, acerto e medalha nao sao falsificaveis
pelo cliente.

**4. Aluno ve tudo, acessa o que assinou.**
`acessos_materia` decide, e a RLS aplica. A interface mostra o cadeado; o
banco e quem realmente barra.

## Onde as coisas vivem

```
FLUXO-QUESTOES.md      como produzir questao nova para o schema v11
supabase/migrations/   0001 schema . 0002 RLS . 0003 gabarito
                       0004 admin+storage . 0005 progresso
scripts/migracao/      legado -> v11, com dry-run e 4 CSV de conferencia
scripts/questoes/      validar e importar lote novo de questoes
scripts/auditoria.py   o que roda em npm run auditar
src/repositories/      unica camada que fala com o banco
src/lib/               errors, imagem (corte 16:9 + capa fallback), auth
src/components/        design system proprio, sem biblioteca de UI
src/app/(app)/         area logada . (auth)/ login
tests/                 embaralhamento, streak, anel, grafico, medalhas
```

## Decisoes que parecem bug e nao sao

- **O streak nao zera de manha.** Se hoje ainda nao tem questao, ele conta a
  partir de ontem. Zerar todo dia ate a pessoa estudar puniria por nada.
- **"Mais constantes da semana" nasce vazio.** So aparece quem ligou o opt-in,
  que vem desligado. Habito de estudo e dado pessoal.
- **Publicar questao pode falhar.** O trigger recusa questao sem 5
  alternativas ou sem gabarito unico. O erro aparece na tela em vez de virar
  sucesso falso.
- **Conquista sem contador simples nao mostra barra.** Barra chutada mente.
- **`/ranking` existe e nao esta no menu.** Decisao do brief; quem chega pelo
  endereco recebe a explicacao.

## Pendencias

- Fuso do streak fixo em `America/Bahia` (`0001`). Turma fora de Sergipe
  exige guardar o fuso por usuario.
- `conteudo_estudo` e `usuarios` do legado sao exportados e **nao**
  importados. XP e streak antigos dependem de casar contas.
- Liberacao de acesso e manual (`acessos_materia`). Integracao com pagamento
  e trabalho proprio.
