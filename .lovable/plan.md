# Module Airbnb / Conciergerie

La page `/airbnb-conciergerie` devient un module complet à 8 écrans, conforme au brief et aux maquettes HTML fournies.

## Structure de la page

Une page unique avec onglets (même style que Gestion Abonnement : onglets centrés, titres h3, couleur active teal) :

1. **Clients & Biens** — répertoire clients (conciergerie / agence / particulier), codification automatique du bien (ex. `GBE004` = 3 lettres du nom + n° d'ordre), fiche bien (typologie, zone, tarif, options, accès/clés, calendrier iCal), badge « seuil 3 biens » = statut conciergerie.
2. **Nouvelle commande** — saisie d'un turnover : bien, date/heure, options (linge, produits, gestion clés…), calcul automatique du prix, délais de commande.
3. **La commande** — dossier unique en 6 blocs (commercial, runner ramassage, laverie/comptage, exécution, signalements, clôture & facturation), chaque acteur écrit son bloc, journal d'audit.
4. **Runner & Linge** — tournée du jour (ramassage / dépôt), espace laverie : comptage pièce par pièce, conversion en sets, montant figé au recomptage.
5. **Planning & Exécution** — remontée J-1 à 18h vers le tableau de bord, fiche de mission, photos attendues, incidents et objets trouvés.
6. **Facturation** — modes « au passage » / « mensuel », cycles et échéances, prorata de démarrage, suspension, leviers du responsable facturation.
7. **Espace conciergerie** — vue portail client (ce que le client voit / peut faire seul) + connexion des calendriers iCal.
8. **Paramètres** — grille tarifaire, zones, options, composition du set de linge (verrouillée par double confirmation), règles.

## Règles métier clés implémentées

- Linge facturé sur la commande de **ramassage**, jamais de dépôt.
- Montant du linge **figé** au recomptage laverie.
- Calcul des sets : `sets = min(housses/1, draps/1, taies/2, gdes serv./2, ptes serv./2)`, puis `montant = sets × 50 + pièces_supp × 5`, minimum 50 DH si comptage > 0.
- Une commande n'est facturable qu'après photos reçues, comptage validé, signalements arbitrés.
- Aucune assignation d'intervenante dans ce module (reste au tableau de bord).

## Technique

- Migration base : tables `airbnb_clients`, `airbnb_biens`, `airbnb_commandes`, `airbnb_linge_comptages`, `airbnb_options`, `airbnb_signalements`, `airbnb_parametres` (+ GRANT et RLS sur chacune).
- Composants sous `src/components/airbnb/` (un par onglet), page `src/pages/AirBnbConciergerie.tsx` en conteneur d'onglets.
- Helpers de calcul (sets linge, prix commande, codification bien) dans `src/lib/airbnb-utils.ts`, testés.
- Design repris des maquettes mais via les tokens du design system existant (teal agence), pas de couleurs en dur.

## Découpage proposé (livraison par lots)

- **Lot 1** : base de données + onglets + écrans 1 (Clients & Biens) et 2 (Nouvelle commande).
- **Lot 2** : écrans 3 (La commande) et 4 (Runner & Linge) avec toute la logique linge.
- **Lot 3** : écrans 5 (Planning), 6 (Facturation).
- **Lot 4** : écrans 7 (Espace conciergerie) et 8 (Paramètres).
