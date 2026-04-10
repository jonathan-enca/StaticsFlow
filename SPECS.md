**STATICSFLOW**

Product Specifications --- Final

v3.0 --- April 2026

*Inspiré d'Odylic Studio • Pipeline Claude → Gemini • BDD vivante*

*Le moteur de génération de créas statiques Meta Ads qui produit des visuels « on brand » inspirés par ce qui marche vraiment. Chaque créa doit avoir l'air d'avoir été faite par le DA interne de la marque.*

MJJ Fashion --- Confidentiel

*Document de mission pour Paperclip (CEO + Dev agents)*

# 1. Vision & Positionnement

## 1.1 Le problème

Les media buyers et équipes e-commerce doivent produire entre 20 et 50 nouvelles créas statiques par semaine. Le process actuel est chronophage : veille manuelle, briefs approximatifs, résultats génériques qui cassent l'image de marque. Les outils IA existants (AdCreative.ai, Canva AI) génèrent des créas reconnaissables comme « faites par IA », inutilisables pour un DA exigeant.

## 1.2 La solution

StaticsFlow est un SaaS de génération de créas statiques Meta Ads qui produit des visuels « on brand », inspirés par une base de données de créas performantes enrichie en continu.

> **Positionnement clé --- À GRAVER DANS LE MARBRE**
>
> Chaque créa générée doit avoir l'air d'avoir été produite par le DA interne de la marque, pas par un robot. Le Brand DNA est le cœur du produit. C'est lui qui garantit le « on brand ». Si une créa a l'air générique, c'est un échec.

## 1.3 Base technique

StaticsFlow s'inspire du projet open-source Odylic Studio (github.com/peterquads/odylic-studio) qui fournit un pipeline fonctionnel Claude (stratégie, copy, QA) → Gemini (génération image) avec 700+ templates d'ads réels.

> **Action requise --- Licence**
>
> Vérifier la licence d'Odylic Studio avant usage commercial. Si pas de licence explicite, contacter le développeur (peterquads) pour obtenir une autorisation écrite, ou s'inspirer de l'architecture sans copier le code.

**Ce qu'on garde de l'architecture Odylic :**

-   Pipeline Claude (stratégie, copy, brief créatif) → Gemini (génération image)

-   Brand DNA extraction depuis URL

-   Récupération automatique des assets

-   QA loop : Claude relit chaque créa (jusqu'à 2 itérations)

**Ce qu'on ajoute (la vraie valeur de StaticsFlow) :**

-   Transformation en SaaS web (auth, paiement, multi-tenant)

-   BDD de créas vivante, enrichie en continu (vs 700 templates figés)

-   Brand DNA enrichi (assets, couleurs, typo, avis clients, mots interdits, personas, charte complète)

-   Mode batch, multi-format, multi-langue, variantes de hooks

-   Templates de brief par industrie

-   Mode Moodboard to Ads

-   Itération en langage naturel (« regénère mais plus premium »)

-   Score prédictif, analyse concurrentielle, mode agence

## 1.4 Cible

-   **Media buyers / agences :** besoin de volume, variété, rapidité

-   **E-commerçants solo :** pas de graphiste, besoin d'un outil clé en main

-   **Marques DTC avec équipe :** scaling créatif sans embaucher

## 1.5 Moat (avantage concurrentiel)

-   BDD vivante enrichie en continu --- les concurrents ont des templates figés

-   Brand DNA complet auto-généré + enrichi --- créas alignées dès la 1ère génération

-   Gemini seul pour l'image --- le seul modèle assez propre pour un usage pro

-   Combinaison unique : veille + intelligence créative + génération + itération

> **Risque identifié --- Dépendance Gemini**
>
> Gemini est le seul modèle utilisé pour la génération d'image. Si Google change l'API, les prix, ou la qualité baisse, il n'y a pas de plan B immédiat. Garder l'architecture modulaire pour pouvoir brancher un autre modèle (Flux, etc.) si nécessaire.

# 2. Brand DNA --- Le cœur du produit

## 2.1 Couche automatique (depuis l'URL)

L'utilisateur colle l'URL de son site. Claude scrape et analyse automatiquement :

-   **Palette couleurs :** extraction des couleurs primaire, secondaire, accent (codes hex)

-   **Typographies :** détection des fonts ou suggestion d'équivalents libres de droit

-   **Logo :** récupération automatique

-   **Photos produit :** scrape de toutes les images produit

-   **Photos lifestyle / ambiance :** visuels éditoriaux

-   **Tone of voice :** analyse du copy (formel/casual, tutoiement/vouvoiement, technique/simple)

-   **Bénéfices clés :** extraction des arguments de vente

-   **Personas :** déduction depuis le positionnement et le prix

-   **Avis clients :** extraction du vocabulaire réel (Trustpilot, avis site) --- les mots qu'ILS utilisent

## 2.2 Couche manuelle (ajouts / corrections)

-   Upload d'assets supplémentaires (packshots, photos studio, UGC)

-   Couleurs spécifiques (hex, Pantone)

-   Upload de fonts custom

-   Mots interdits / wording obligatoire (contraintes réglementaires)

-   Personas spécifiques détaillés

-   Brief créatif libre (« on veut être perçu comme X, jamais comme Y »)

-   Angles de communication préférés et interdits

Le Brand DNA est une fiche marque vivante, modifiable à tout moment. Chaque génération pioche dedans automatiquement.

# 3. Base de données de créas --- Le moat

## 3.1 Principe

StaticsFlow maintient une BDD de créas statiques performantes. C'est le moteur d'inspiration du générateur --- elle garantit que les créas s'inspirent de ce qui marche vraiment, pas de templates génériques figés.

> **Différenciateur clé**
>
> Odylic a 700 templates statiques qui ne bougent plus. Après 3 batches l'utilisateur tourne en rond. StaticsFlow enrichit sa BDD en continu --- chaque nouvelle génération bénéficie de nouvelles inspirations.

## 3.2 Alimentation : sourcing semi-manuel + analyse auto

**Étape 1 --- Sourcing (le fondateur) :**

Le fondateur source quotidiennement les meilleures créas via ses outils de veille (TrendTrack, Foreplay, Meta Ad Library). Filtre humain de qualité --- seules les créas qui performent vraiment entrent dans la BDD.

**Étape 2 --- Upload batch (admin) :**

Les créas sont uploadées en lot dans le BDD Manager (espace admin). Glisser-déposer, import par dossier.

**Étape 3 --- Analyse auto (Claude) :**

À chaque upload, Claude analyse automatiquement chaque créa et génère :

-   **Catégorie produit :** skincare, food, fashion, tech, fitness, home, beauty, health, pet, etc.

-   **Type de créa :** product hero, before/after, comparatif, testimonial, promo/offre, UGC screenshot, lifestyle, data/stats, listicle, press mention

-   **Structure / layout :** grille, split, centré, overlay, etc.

-   **Hook textuel :** pain, curiosité, social proof, FOMO, bénéfice direct, autorité, urgence

-   **Palette dominante :** couleurs principales

-   **Langue :** détection automatique

Les utilisateurs finaux voient la bibliothèque enrichie et classée. Ils ne savent pas que le sourcing est manuel.

> **Risque identifié --- Goulot d'étranglement**
>
> Le fondateur est le seul à sourcer les créas. Prévoir rapidement un process délégable (assistant, freelance, ou agent IA) pour ne pas bloquer l'alimentation de la BDD.

## 3.3 Objectifs de volume

  --------------- --------------------------- ----------------------------
  **Phase**       **Volume BDD**              **Fréquence**

  Lancement       1 000 créas classées        Constitution initiale

  Mois 2-3        2 500+                      50-100 nouvelles / semaine

  Mois 4-6        5 000+                      100+ / semaine

  Mois 6+         10 000+                     Automation partielle (V2)
  --------------- --------------------------- ----------------------------

# 4. Pipeline de génération

## 4.1 Workflow en 6 étapes

**1. Brand DNA Extraction ---** URL → Claude scrape et construit le profil de marque complet. L'utilisateur valide et enrichit.

**2. Asset Collection ---** Images produit, logos, lifestyle récupérés auto du site + upload manuel d'assets supplémentaires.

**3. Template Matching ---** Claude analyse la BDD vivante de StaticsFlow et sélectionne les meilleures inspirations pour la catégorie et l'angle. L'utilisateur peut aussi choisir ses propres inspi, coller l'URL d'une pub concurrente, ou uploader un moodboard.

**4. Creative Briefing ---** Claude rédige un brief détaillé pour chaque ad : headline, copy, layout, placement assets, angle stratégique --- calibré sur le Brand DNA.

**5. Image Generation (Gemini) ---** Gemini reçoit le brief, la référence de template et les vraies photos produit. Il compose le visuel final avec les assets réels de la marque (pas de produit généré par IA). Gemini est le seul modèle utilisé pour l'image.

**6. QA Loop (Claude) ---** Claude relit chaque créa : cohérence Brand DNA, qualité texte, qualité visuelle. Feedback + régénération si problème (max 2 itérations).

## 4.2 Features de génération

-   **Mode batch :** générer 5, 10 ou 20 créas d'un coup avec des angles différents

-   **Variantes de hook :** 3 variantes automatiques par créa (pain, curiosité, social proof)

-   **Multi-format :** 1080×1080, 1080×1350, 1200×628 avec adaptation intelligente du layout

-   **Multi-langue :** générer la même créa en FR, EN, DE

-   **Templates de brief :** briefs pré-remplis par industrie (« Promo flash skincare », « Lancement produit food », « Retargeting abandon panier »). L'utilisateur choisit, ajuste 2-3 paramètres, et lance.

-   **Moodboard to Ads :** upload d'un moodboard ou screenshot Pinterest → génération de créas dans cet univers visuel

-   **Inspi URL :** coller l'URL d'une pub concurrente → « fais-moi une variante pour mon produit »

-   **Itération en langage naturel :** « Regénère mais plus premium », « hook plus agressif », « plus de contraste » --- l'IA itère sans repartir de zéro

-   **Edition inline :** édition du copy directement dans la prévisualisation

-   **Export en lot :** téléchargement groupé avec nommage propre (marque_angle_format_date)

## 4.3 Score prédictif

Chaque créa reçoit un score estimé basé sur sa similarité avec les top performers de la BDD dans la même catégorie.

# 5. Analyse concurrentielle intégrée

L'utilisateur ajoute 3 à 5 URLs de concurrents. StaticsFlow analyse leurs créas actives :

-   Angles et formats les plus utilisés par les concurrents

-   Trous dans la raquette --- angles non exploités

-   Suggestions de différenciation créative

# 6. Web App SaaS

## 6.1 Pages

  ------------------- ---------------------------------------------------------------------------
  **Page**            **Description**

  Onboarding          URL → Brand DNA auto (30s) → validation → 1ère créa. Wow moment \< 3 min.

  Dashboard           Créas récentes, stats, BDD trending

  Brand DNA           Fiche marque complète (auto + manuel)

  Bibliothèque        BDD par catégorie, type, angle. Filtres, favoris.

  Générateur          Brief → inspi/moodboard → génération → itération → export

  Historique          Toutes les créas générées, filtrables

  Concurrents         Analyse concurrentielle

  Admin BDD           Upload batch + analyse auto (admin only)

  Compte              API keys (BYOK), abonnement, équipe
  ------------------- ---------------------------------------------------------------------------

## 6.2 Onboarding (le wow moment)

3 étapes, moins de 3 minutes :

-   Coller l'URL → extraction auto (30 secondes)

-   Résumé Brand DNA → valider ou corriger

-   1ère créa générée → voir la valeur immédiatement

Si le wow moment ne vient pas en 3 minutes, on perd l'utilisateur.

## 6.3 Mode agence

Plusieurs marques depuis un seul compte. Chaque marque a son Brand DNA, sa charte, ses créas. Workflow de validation : généré → en review → validé → exporté.

# 7. Pricing

## 7.1 Structure

**Abonnement mensuel** (accès plateforme) + BYOK (Bring Your Own Keys) pour la consommation IA.

L'utilisateur branche ses propres clés API Claude et Gemini. Pas de surcoût de génération côté StaticsFlow.

> **V2 --- Crédits intégrés**
>
> Option d'achat de crédits directement dans StaticsFlow pour les utilisateurs non techniques. Ajouté une fois le product-market fit validé.

## 7.2 Plans

  ----------------- ----------------- ----------------- -------------------------
                    **Starter**       **Pro**           **Agency**

  Prix/mois         29€               79€               199€

  Marques           1                 3                 Illimité

  BDD inspi         Complète          Complète          Complète + early access

  Brand DNA         1                 3                 Illimité

  Concurrents       3                 5                 15

  Multi-format      ✔                 ✔                 ✔

  Multi-langue      ---               ✔                 ✔

  Mode agence       ---               ---               ✔

  Collaboration     ---               ✔                 ✔
  ----------------- ----------------- ----------------- -------------------------

# 8. Roadmap

## Phase 1 --- Fondations (semaines 1-3)

-   S'inspirer de l'architecture Odylic Studio, comprendre le pipeline

-   Construire la web app : Next.js + React + Tailwind

-   Setup auth (Clerk ou NextAuth), Stripe (abonnements), PostgreSQL, S3/R2

-   Reproduire le pipeline Claude → Gemini pour la génération

-   Déploiement continu (Vercel + Railway)

## Phase 2 --- BDD + Brand DNA (semaines 3-5)

-   BDD Manager admin (upload batch + analyse auto Claude)

-   Sourcer et uploader les 1 000 premières créas

-   Brand DNA enrichi (avis clients, mots interdits, assets, charte)

-   Bibliothèque d'inspi utilisateur (navigation, filtres, favoris)

## Phase 3 --- Générateur complet (semaines 5-8)

-   Génération unitaire avec Brand DNA + BDD vivante

-   Onboarding : URL → Brand DNA → 1ère créa (\< 3 minutes)

-   Mode batch (5/10/20 créas)

-   Multi-format, multi-langue, variantes de hooks

-   Templates de brief par industrie

-   Moodboard to Ads

-   Itération en langage naturel

-   Edition inline + export en lot

-   Intégration BYOK

## Phase 4 --- Intelligence + agence (semaines 9-12)

-   Score prédictif

-   Analyse concurrentielle intégrée

-   Inspi depuis URL concurrente

-   Mode agence multi-marques

-   Collaboration / workflow de validation

-   Copywriting du site StaticsFlow (Agent Growth)

## Phase 5 --- V2 (post-lancement)

-   Crédits intégrés (option achat sans clés API)

-   Notifications tendances créatives

-   Automatisation progressive du sourcing BDD

-   Connexion Meta Ads pour feedback de performance (CTR/ROAS)

-   Emails d'onboarding et de rétention

# 9. Stack technique

  -------------------------- -------------------------------------------------------
  **Composant**              **Technologie**

  Inspiration                Architecture Odylic Studio (pipeline Claude → Gemini)

  Frontend                   Next.js + React + Tailwind CSS

  Backend                    Next.js API routes + Node.js

  Base de données            PostgreSQL (Supabase ou Railway) + Redis (queues)

  IA --- Stratégie/Copy/QA   Claude API (Anthropic)

  IA --- Image               Gemini API (Google) --- seul modèle pour le visuel

  Auth                       Clerk ou NextAuth

  Paiement                   Stripe (abonnements)

  Hébergement                Vercel (front) + Railway (back/BDD)

  Storage                    Cloudflare R2 ou AWS S3

  Scraping                   Puppeteer (Brand DNA extraction)
  -------------------------- -------------------------------------------------------

# 10. Équipe Paperclip

> **Stratégie de démarrage**
>
> Commencer avec 2 agents uniquement (CEO + Dev). Ajouter les agents Growth et Designer UI/UX une fois que Paperclip est maîtrisé et que la Phase 1 est terminée. Le fondateur agit comme Board --- il valide les décisions clés.

## 10.1 CEO Agent (dès le départ)

**Rôle :** Décompose les specs en tâches, priorise selon la roadmap, délègue, valide le travail avant merge.

**Modèle :** Claude Opus 4.6

**System prompt :** Tu es le CEO de StaticsFlow, un SaaS de génération de créas statiques Meta Ads on-brand. Le produit s'inspire d'Odylic Studio (pipeline Claude → Gemini). Ton job : décomposer les specs produit (document v3.0) en tâches actionables, les prioriser selon la roadmap (Phase 1 → 5), les assigner au Dev. Tu ne codes jamais. Tu reviews le travail du Dev avant de valider. Tu remontes les décisions architecturales au Board (le fondateur). Rappel fondamental : chaque créa générée doit être « on brand » --- si elle a l'air générique, c'est un échec.

## 10.2 Dev Agent (dès le départ)

**Rôle :** Développement full-stack, intégrations API, déploiement.

**Modèle :** Claude Sonnet 4.6

**System prompt :** Tu es le développeur principal de StaticsFlow. Stack : Next.js + React + Tailwind + PostgreSQL + Node.js. Tu reproduis le pipeline Claude → Gemini inspiré d'Odylic Studio. Tu ajoutes : auth (Clerk), paiement (Stripe), multi-tenant, BDD Manager admin, Brand DNA enrichi. Tu écris du code propre, commenté, avec des tests. Tu déploies sur Vercel/Railway. Tu suis les tâches assignées par le CEO. Gemini est le SEUL modèle utilisé pour la génération d'image.

## 10.3 Growth Agent (ajouté Phase 4)

**Rôle :** Rédiger le copywriting du site StaticsFlow (landing page, pricing, onboarding).

**Modèle :** Claude Sonnet 4.6

**System prompt :** Tu es le Growth Manager de StaticsFlow. Tu rédiges tout le contenu du site : landing page, page pricing, textes d'onboarding. Le ton doit être professionnel mais accessible. Tu t'adresses à des media buyers, e-commerçants et marques DTC. Tu mets en avant le Brand DNA et le « on brand » comme différenciateurs.

## 10.4 Designer UI/UX Agent (ajouté Phase 4)

**Rôle :** Reviewer chaque page pour la cohérence visuelle et l'expérience utilisateur.

**Modèle :** Claude Opus 4.6

**System prompt :** Tu es le Designer UI/UX de StaticsFlow. Tu reviews chaque page et composant : cohérence visuelle, accessibilité, fluidité de navigation. Tu vérifies que l'onboarding prend moins de 3 minutes. Tu proposes des améliorations UX basées sur les best practices SaaS (Stripe, Linear, Notion comme références). Tu ne codes pas --- tu produis des specs visuelles pour le Dev.

# 11. KPIs de succès

## 11.1 Produit

-   Onboarding \< 3 minutes

-   Taux de créas exportées vs générées \> 60%

-   BDD : +50-100 nouvelles créas / semaine

-   Zéro créa générique --- chaque output est identifiable comme « on brand »

## 11.2 Business

-   100 utilisateurs actifs à 3 mois

-   MRR 5 000€ à 6 mois

-   Churn \< 8% mensuel

# 12. Risques identifiés et mitigations

  ------------------- ----------------------------------- -----------------------------------------------------------------
  **Risque**          **Impact**                          **Mitigation**

  Licence Odylic      Blocage légal si usage commercial   Contacter le dev ou reconstruire sans copier le code

  Dépendance Gemini   Pas de plan B pour l'image          Architecture modulaire, adapter si un meilleur modèle émerge

  Goulot BDD          Fondateur = seul sourceur           Déléguer rapidement (assistant, freelance, automation)

  Scope ambitieux     Retard de livraison                 2 agents au démarrage, ajout progressif

  Coût API agents     Budget Paperclip élevé              Budgets stricts, Sonnet par défaut, Opus uniquement pour CEO/QA

  Scraping Meta       Blocage API pour veille auto        Sourcing manuel au lancement, automation progressive
  ------------------- ----------------------------------- -----------------------------------------------------------------
