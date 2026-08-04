-- =============================================================================
-- EstudeVet v11 - Seed
-- Matriz Curricular 2023/1 - Medicina Veterinaria - Faculdade Pio Decimo.
-- Catalogo completo dos 10 periodos. `ativa = true` apenas nas materias que
-- entram no ar agora; as demais ficam cadastradas e desligadas.
-- Idempotente: pode rodar mais de uma vez.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PERIODOS
-- ---------------------------------------------------------------------------
insert into public.periodos (numero, nome) values
  (1, '1o Periodo'),
  (2, '2o Periodo'),
  (3, '3o Periodo'),
  (4, '4o Periodo'),
  (5, '5o Periodo'),
  (6, '6o Periodo'),
  (7, '7o Periodo'),
  (8, '8o Periodo'),
  (9, '9o Periodo'),
  (10, '10o Periodo')
on conflict (numero) do nothing;

-- ---------------------------------------------------------------------------
-- MATERIAS
-- `codigo` nao e unico de proposito: a matriz repete MV200246 no 8o periodo.
-- Sem constraint de soma de carga horaria: a matriz traz Farmacologia com
-- CH/P 80 e TEO 100.
-- ---------------------------------------------------------------------------
insert into public.materias
  (periodo_id, codigo, nome, slug, creditos, ch_total, ch_teorica, ch_pratica, ch_afec, ativa, ordem)
values
  ((select id from public.periodos where numero = 1), 'MV200262', 'Anatomia Veterinária I', 'anatomia-veterinaria-i', 5, 100, 20, 60, 20, false, 1),
  ((select id from public.periodos where numero = 1), 'MV200178', 'Biofísica', 'biofisica', 2, 40, 36, 4, null, false, 2),
  ((select id from public.periodos where numero = 1), 'MV200177', 'Biologia Celular e Molecular', 'biologia-celular-e-molecular', 4, 80, 40, 20, 20, false, 3),
  ((select id from public.periodos where numero = 1), 'MV200252', 'Bioquímica Veterinária', 'bioquimica-veterinaria', 4, 80, 40, 40, null, false, 4),
  ((select id from public.periodos where numero = 1), 'MV200195', 'Informática Veterinária', 'informatica-veterinaria', 2, 40, 40, null, null, false, 5),
  ((select id from public.periodos where numero = 1), 'MV200173', 'Introdução à Medicina Veterinária', 'introducao-a-medicina-veterinaria', 1, 20, 16, 4, null, false, 6),
  ((select id from public.periodos where numero = 1), 'MV200269', 'Metodologia do Trabalho Científico', 'metodologia-do-trabalho-cientifico', 2, 40, 40, null, null, false, 7),
  ((select id from public.periodos where numero = 1), 'MV200254', 'Práticas Hospitalares', 'praticas-hospitalares', 2, 40, null, 20, 20, false, 8),
  ((select id from public.periodos where numero = 2), 'MV200263', 'Anatomia Veterinária II', 'anatomia-veterinaria-ii', 5, 100, 20, 60, 20, false, 1),
  ((select id from public.periodos where numero = 2), 'MV200253', 'Bioestatística', 'bioestatistica', 3, 60, 60, null, null, false, 2),
  ((select id from public.periodos where numero = 2), 'MV200255', 'Sociedade, Políticas Públicas e Extensão Rural', 'sociedade-politicas-publicas-e-extensao-rural', 2, 40, 40, null, null, false, 3),
  ((select id from public.periodos where numero = 2), 'MV200182', 'Histologia e Embriologia Veterinária', 'histologia-e-embriologia-veterinaria', 4, 80, 40, 40, null, false, 4),
  ((select id from public.periodos where numero = 2), 'MV200193', 'Imunologia Veterinária', 'imunologia-veterinaria', 3, 60, 60, null, null, false, 5),
  ((select id from public.periodos where numero = 2), 'MV200094', 'Parasitologia Veterinária', 'parasitologia-veterinaria', 4, 80, 50, 20, 10, false, 6),
  ((select id from public.periodos where numero = 3), 'MV200192', 'Bioclimatologia e Bem Estar Animal', 'bioclimatologia-e-bem-estar-animal', 2, 40, 36, 4, null, false, 1),
  ((select id from public.periodos where numero = 3), 'MV200188', 'Fisiologia Veterinária I', 'fisiologia-veterinaria-i', 4, 80, 80, null, null, false, 2),
  ((select id from public.periodos where numero = 3), 'MV200189', 'Microbiologia Veterinária', 'microbiologia-veterinaria', 5, 100, 40, 20, 20, false, 3),
  ((select id from public.periodos where numero = 3), 'MV200183', 'Genética Aplicada', 'genetica-aplicada', 3, 60, 40, null, 20, false, 4),
  ((select id from public.periodos where numero = 3), 'MV200190', 'Plantas Forrageiras e Pastagens', 'plantas-forrageiras-e-pastagens', 3, 60, 30, 20, 10, false, 5),
  ((select id from public.periodos where numero = 3), 'MV200202', 'Nutrição Animal', 'nutricao-animal', 3, 60, 60, null, null, false, 6),
  ((select id from public.periodos where numero = 3), 'MV200198', 'Doenças Parasitárias dos Animais Domésticos', 'doencas-parasitarias-dos-animais-domesticos', 4, 80, 60, null, 20, false, 7),
  ((select id from public.periodos where numero = 4), 'MV200217', 'Semiologia Básica', 'semiologia-basica', 3, 60, 40, 20, null, true, 1),
  ((select id from public.periodos where numero = 4), 'MV200264', 'Economia e Gestão Aplicada ao Agronegócio', 'economia-e-gestao-aplicada-ao-agronegocio', 2, 40, 30, null, 10, false, 2),
  ((select id from public.periodos where numero = 4), 'MV200258', 'Tecnologia de Produtos de Origem Animal', 'tecnologia-de-produtos-de-origem-animal', 3, 60, 60, null, null, false, 3),
  ((select id from public.periodos where numero = 4), 'MV200197', 'Fisiologia Veterinária II', 'fisiologia-veterinaria-ii', 5, 100, 100, null, null, false, 4),
  ((select id from public.periodos where numero = 4), 'MV200203', 'Melhoramento Animal', 'melhoramento-animal', 3, 60, 40, null, 20, false, 5),
  ((select id from public.periodos where numero = 4), 'MV200211', 'Alimentos e Alimentação', 'alimentos-e-alimentacao', 2, 40, 40, null, null, false, 6),
  ((select id from public.periodos where numero = 4), 'MV200213', 'Doenças Infecto-Contagiosas dos Animais Domésticos', 'doencas-infecto-contagiosas-dos-animais-domesticos', 4, 80, 40, 20, 20, false, 7),
  ((select id from public.periodos where numero = 5), 'MV200259', 'Zootecnia I', 'zootecnia-i', 3, 60, 50, 10, null, true, 1),
  ((select id from public.periodos where numero = 5), 'MV200206', 'Análises Clínicas Veterinárias', 'analises-clinicas-veterinarias', 3, 60, 40, 20, null, true, 2),
  ((select id from public.periodos where numero = 5), 'MV200265', 'Empreendedorismo e Gestão de Carreira Aplicada à Medicina Veterinária', 'empreendedorismo-e-gestao-de-carreira-aplicada-a-medicina-veterinaria', 3, 60, 40, null, 20, false, 3),
  ((select id from public.periodos where numero = 5), 'MV200257', 'Farmacologia Veterinária e Toxicologia', 'farmacologia-veterinaria-e-toxicologia', 4, 80, 100, null, null, true, 4),
  ((select id from public.periodos where numero = 5), 'MV200207', 'Patologia Veterinária Geral', 'patologia-veterinaria-geral', 4, 80, 40, 40, null, true, 5),
  ((select id from public.periodos where numero = 5), 'MV200235', 'Inspeção de Leite, Produtos Lácteos e Mel', 'inspecao-de-leite-produtos-lacteos-e-mel', 3, 60, 40, 10, 10, true, 6),
  ((select id from public.periodos where numero = 5), 'MV200256', 'Diagnóstico por Imagem', 'diagnostico-por-imagem', 3, 60, 40, 20, null, false, 7),
  ((select id from public.periodos where numero = 6), 'MV200230', 'Anestesiologia Veterinária', 'anestesiologia-veterinaria', 3, 60, 40, 10, 10, false, 1),
  ((select id from public.periodos where numero = 6), 'MV200214', 'Patologia Veterinária Especial', 'patologia-veterinaria-especial', 5, 100, 40, 60, null, false, 2),
  ((select id from public.periodos where numero = 6), 'MV200224', 'Técnica Cirúrgica', 'tecnica-cirurgica', 4, 80, 40, 40, null, false, 3),
  ((select id from public.periodos where numero = 6), 'MV2002015', 'Terapêutica Veterinária', 'terapeutica-veterinaria', 3, 60, 50, 10, null, false, 4),
  ((select id from public.periodos where numero = 6), 'MV200260', 'Zootecnia II', 'zootecnia-ii', 3, 60, 50, 10, null, false, 5),
  ((select id from public.periodos where numero = 6), 'MV200236', 'Inspeção de Carne, Pescados, Ovos e Derivados', 'inspecao-de-carne-pescados-ovos-e-derivados', 3, 60, 45, 5, 10, false, 6),
  ((select id from public.periodos where numero = 6), 'MV200266', 'Práticas Extensionistas', 'praticas-extensionistas', 2, 40, null, null, 40, false, 7),
  ((select id from public.periodos where numero = 7), 'MV200261', 'Clínica Cirúrgica de Cães e Gatos', 'clinica-cirurgica-de-caes-e-gatos', 4, 80, 40, 30, 10, false, 1),
  ((select id from public.periodos where numero = 7), 'MV200228', 'Ginecologia e Andrologia Veterinária', 'ginecologia-e-andrologia-veterinaria', 4, 80, 70, 10, null, false, 2),
  ((select id from public.periodos where numero = 7), 'MV200227', 'Epidemiologia, Zoonoses e Saúde Pública', 'epidemiologia-zoonoses-e-saude-publica', 4, 80, 50, 10, 20, false, 3),
  ((select id from public.periodos where numero = 7), 'MV200270', 'Semiologia e Clínica de Animais Silvestres', 'semiologia-e-clinica-de-animais-silvestres', 4, 80, 50, 10, 20, false, 4),
  ((select id from public.periodos where numero = 7), 'MV200229', 'Semiologia e Clínica Médica de Cães e Gatos I', 'semiologia-e-clinica-medica-de-caes-e-gatos-i', 3, 60, 40, 10, 10, false, 5),
  ((select id from public.periodos where numero = 7), 'MV200234', 'Semiologia e Clínica Médica de Ruminantes I', 'semiologia-e-clinica-medica-de-ruminantes-i', 3, 60, 40, 10, 10, false, 6),
  ((select id from public.periodos where numero = 8), 'MV200246', 'Clínica Médica de Ruminantes II', 'clinica-medica-de-ruminantes-ii', 3, 60, 50, 10, null, false, 1),
  ((select id from public.periodos where numero = 8), 'MV200246', 'Defesa Sanitária Animal', 'defesa-sanitaria-animal', 3, 60, 50, null, 10, false, 2),
  ((select id from public.periodos where numero = 8), 'MV200231', 'Obstetrícia Veterinária', 'obstetricia-veterinaria', 3, 60, 50, 10, null, false, 3),
  ((select id from public.periodos where numero = 8), 'MV200238', 'Ornitopatologia', 'ornitopatologia', 3, 60, 55, 5, null, false, 4),
  ((select id from public.periodos where numero = 8), 'MV200225', 'Aquicultura', 'aquicultura', 3, 60, 30, 10, 20, true, 5),
  ((select id from public.periodos where numero = 8), 'MV200267', 'Semiologia e Clínica Médica de Cães e Gatos II', 'semiologia-e-clinica-medica-de-caes-e-gatos-ii', 3, 60, 40, 10, 10, false, 6),
  ((select id from public.periodos where numero = 8), 'MV200242', 'Semiologia e Clínica Médica de Equídeos', 'semiologia-e-clinica-medica-de-equideos', 4, 80, 40, 20, 20, false, 7),
  ((select id from public.periodos where numero = 9), 'MV200243', 'Biotecnologia', 'biotecnologia', 3, 60, 40, 20, null, false, 1),
  ((select id from public.periodos where numero = 9), 'MV200244', 'Clínica Cirúrgica de Equídeos e Ruminantes', 'clinica-cirurgica-de-equideos-e-ruminantes', 4, 80, 70, 10, null, false, 2),
  ((select id from public.periodos where numero = 9), 'MV200240', 'Deontologia e Legislação Veterinária', 'deontologia-e-legislacao-veterinaria', 2, 40, 30, null, 10, false, 3),
  ((select id from public.periodos where numero = 9), 'MV200271', 'Estágio Curricular Prático Hospitalar em Anestesiologia, Clínica Médica e Cirúrgica e Métodos Diagnósticos em Grandes Animais', 'estagio-curricular-pratico-hospitalar-em-anestesiologia-clinica-medica', 2, 40, null, 40, null, false, 4),
  ((select id from public.periodos where numero = 9), 'MV200274', 'Estágio Curricular Prático Hospitalar em Anestesiologia, Clínica Médica e Cirúrgica e Métodos Diagnósticos em Pequenos Animais', 'estagio-curricular-pratico-hospitalar-em-anestesiologia-clinica-medica', 2, 40, null, 40, null, false, 5),
  ((select id from public.periodos where numero = 9), 'MV200275', 'Estágio Curricular Prático Hospitalar em Anestesiologia, Clínica Médica e Cirúrgica e Métodos Diagnósticos em Animais Silvestres', 'estagio-curricular-pratico-hospitalar-em-anestesiologia-clinica-medica', 2, 40, null, 40, null, false, 6),
  ((select id from public.periodos where numero = 9), 'MV200276', 'Estágio Curricular Prático Hospitalar em Produção, Reprodução e Obstetrícia', 'estagio-curricular-pratico-hospitalar-em-producao-reproducao-e-obstetr', 2, 40, null, 40, null, false, 7),
  ((select id from public.periodos where numero = 9), 'MV200277', 'Estágio Curricular Prático Hospitalar em Tecnologia, Inspeção Sanitária, Zoonoses, Epidemiologia e Saúde Pública', 'estagio-curricular-pratico-hospitalar-em-tecnologia-inspecao-sanitaria', 2, 40, null, 40, null, false, 8),
  ((select id from public.periodos where numero = 10), 'MV200247', 'Estágio Supervisionado II', 'estagio-supervisionado-ii', 10, 200, null, 200, null, false, 1),
  ((select id from public.periodos where numero = 10), 'MV200273', 'Trabalho de Conclusão de Curso', 'trabalho-de-conclusao-de-curso', 3, 60, 20, 40, null, false, 2),
  ((select id from public.periodos where numero = 10), 'MV200168', 'Língua Brasileira de Sinais', 'lingua-brasileira-de-sinais', 2, 40, null, 40, null, false, 3),
  ((select id from public.periodos where numero = 10), 'MV200251', 'Optativa I', 'optativa-i', 2, 40, 40, null, null, false, 4)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- PRE-REQUISITOS
-- "Vestibular" na matriz significa ausencia de pre-requisito: nao vira linha.
-- ---------------------------------------------------------------------------
insert into public.materia_prerequisitos (materia_id, prerequisito_id)
select m.id, p.id from (values
  ('anatomia-veterinaria-ii', 'anatomia-veterinaria-i'),
  ('histologia-e-embriologia-veterinaria', 'biologia-celular-e-molecular'),
  ('fisiologia-veterinaria-i', 'bioquimica-veterinaria'),
  ('fisiologia-veterinaria-i', 'histologia-e-embriologia-veterinaria'),
  ('nutricao-animal', 'bioquimica-veterinaria'),
  ('doencas-parasitarias-dos-animais-domesticos', 'parasitologia-veterinaria'),
  ('semiologia-basica', 'anatomia-veterinaria-ii'),
  ('tecnologia-de-produtos-de-origem-animal', 'microbiologia-veterinaria'),
  ('fisiologia-veterinaria-ii', 'fisiologia-veterinaria-i'),
  ('melhoramento-animal', 'bioestatistica'),
  ('melhoramento-animal', 'genetica-aplicada'),
  ('alimentos-e-alimentacao', 'nutricao-animal'),
  ('doencas-infecto-contagiosas-dos-animais-domesticos', 'microbiologia-veterinaria'),
  ('zootecnia-i', 'alimentos-e-alimentacao'),
  ('analises-clinicas-veterinarias', 'biologia-celular-e-molecular'),
  ('farmacologia-veterinaria-e-toxicologia', 'bioquimica-veterinaria'),
  ('patologia-veterinaria-geral', 'fisiologia-veterinaria-ii'),
  ('patologia-veterinaria-geral', 'anatomia-veterinaria-ii'),
  ('inspecao-de-leite-produtos-lacteos-e-mel', 'tecnologia-de-produtos-de-origem-animal'),
  ('diagnostico-por-imagem', 'anatomia-veterinaria-ii'),
  ('anestesiologia-veterinaria', 'farmacologia-veterinaria-e-toxicologia'),
  ('patologia-veterinaria-especial', 'patologia-veterinaria-geral'),
  ('tecnica-cirurgica', 'anatomia-veterinaria-ii'),
  ('terapeutica-veterinaria', 'farmacologia-veterinaria-e-toxicologia'),
  ('zootecnia-ii', 'alimentos-e-alimentacao'),
  ('inspecao-de-carne-pescados-ovos-e-derivados', 'tecnologia-de-produtos-de-origem-animal'),
  ('clinica-cirurgica-de-caes-e-gatos', 'tecnica-cirurgica'),
  ('ginecologia-e-andrologia-veterinaria', 'patologia-veterinaria-especial'),
  ('epidemiologia-zoonoses-e-saude-publica', 'doencas-infecto-contagiosas-dos-animais-domesticos'),
  ('epidemiologia-zoonoses-e-saude-publica', 'doencas-parasitarias-dos-animais-domesticos'),
  ('semiologia-e-clinica-de-animais-silvestres', 'patologia-veterinaria-especial'),
  ('semiologia-e-clinica-de-animais-silvestres', 'semiologia-basica'),
  ('semiologia-e-clinica-de-animais-silvestres', 'terapeutica-veterinaria'),
  ('semiologia-e-clinica-medica-de-caes-e-gatos-i', 'patologia-veterinaria-especial'),
  ('semiologia-e-clinica-medica-de-caes-e-gatos-i', 'semiologia-basica'),
  ('semiologia-e-clinica-medica-de-caes-e-gatos-i', 'terapeutica-veterinaria'),
  ('semiologia-e-clinica-medica-de-ruminantes-i', 'patologia-veterinaria-especial'),
  ('semiologia-e-clinica-medica-de-ruminantes-i', 'semiologia-basica'),
  ('semiologia-e-clinica-medica-de-ruminantes-i', 'terapeutica-veterinaria'),
  ('clinica-medica-de-ruminantes-ii', 'semiologia-e-clinica-medica-de-ruminantes-i'),
  ('defesa-sanitaria-animal', 'epidemiologia-zoonoses-e-saude-publica'),
  ('obstetricia-veterinaria', 'ginecologia-e-andrologia-veterinaria'),
  ('ornitopatologia', 'patologia-veterinaria-especial'),
  ('aquicultura', 'alimentos-e-alimentacao'),
  ('semiologia-e-clinica-medica-de-caes-e-gatos-ii', 'semiologia-e-clinica-medica-de-caes-e-gatos-i'),
  ('semiologia-e-clinica-medica-de-equideos', 'patologia-veterinaria-especial'),
  ('semiologia-e-clinica-medica-de-equideos', 'semiologia-basica'),
  ('semiologia-e-clinica-medica-de-equideos', 'terapeutica-veterinaria'),
  ('biotecnologia', 'ginecologia-e-andrologia-veterinaria'),
  ('clinica-cirurgica-de-equideos-e-ruminantes', 'tecnica-cirurgica')
) as v(materia_slug, prereq_slug)
join public.materias m on m.slug = v.materia_slug
join public.materias p on p.slug = v.prereq_slug
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- CONQUISTAS
-- Sem emoji. O desenho da medalha e feito em SVG na paleta da marca (S6).
-- ---------------------------------------------------------------------------
insert into public.conquistas (codigo, nome, descricao, criterio, ordem) values
  ('primeiro_simulado', 'Primeiro passo', 'Concluiu o primeiro simulado.',
   '{"tipo":"simulados_concluidos","valor":1}', 1),
  ('streak_3',   'Tres dias seguidos', 'Bateu o minimo diario por 3 dias seguidos.',
   '{"tipo":"streak_dias","valor":3}', 2),
  ('streak_7',   'Uma semana inteira', 'Bateu o minimo diario por 7 dias seguidos.',
   '{"tipo":"streak_dias","valor":7}', 3),
  ('streak_30',  'Um mes de constancia', 'Bateu o minimo diario por 30 dias seguidos.',
   '{"tipo":"streak_dias","valor":30}', 4),
  ('meta_semanal_1', 'Meta batida', 'Cumpriu a meta semanal de questoes uma vez.',
   '{"tipo":"metas_semanais","valor":1}', 5),
  ('meta_semanal_4', 'Mes no alvo', 'Cumpriu a meta semanal quatro semanas seguidas.',
   '{"tipo":"metas_semanais_seguidas","valor":4}', 6),
  ('questoes_100',  'Cem questoes', 'Respondeu 100 questoes.',
   '{"tipo":"questoes_respondidas","valor":100}', 7),
  ('questoes_500',  'Quinhentas questoes', 'Respondeu 500 questoes.',
   '{"tipo":"questoes_respondidas","valor":500}', 8),
  ('questoes_1000', 'Mil questoes', 'Respondeu 1000 questoes.',
   '{"tipo":"questoes_respondidas","valor":1000}', 9),
  ('acerto_80',  'Mira calibrada', 'Fechou um simulado de 30 questoes com 80% ou mais.',
   '{"tipo":"acerto_simulado","valor":80,"minimo_questoes":30}', 10),
  ('materia_dominada', 'Materia dominada', 'Atingiu 85% de acerto em uma materia com ao menos 100 questoes respondidas.',
   '{"tipo":"acerto_materia","valor":85,"minimo_questoes":100}', 11),
  ('virada_de_erro', 'Erro corrigido', 'Acertou 20 questoes que ja tinha errado antes.',
   '{"tipo":"erros_revertidos","valor":20}', 12)
on conflict (codigo) do nothing;
