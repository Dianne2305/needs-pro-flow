

# Back-Office Agence Ménage - Phase 1

## Vue d'ensemble
Application de gestion back-office pour une agence de services de ménage/nettoyage, avec une interface professionnelle aux couleurs de la marque (#0b7f7a). Données stockées dans une base Supabase (Lovable Cloud). Phase 1 = les 2 pages essentielles + la navigation complète.

---

## Navigation latérale (Sidebar)
Menu avec les entrées suivantes (les pages non implémentées en phase 1 afficheront "Bientôt disponible") :
- 🏠 Tableau de bord (actif)
- ⏳ Demandes en attente
- 👤 Listing profils *(phase 2)*
- 🏢 Listing clients *(phase 2)*
- 💰 Facturation *(phase 2)*
- ⚙️ Paramètres *(phase 2)*

---

## Page 1 : Demandes clients en attente de confirmation

Page listant les demandes clients arrivant du formulaire externe (saisie manuelle ou import).

**Fonctionnalités :**
- Formulaire d'ajout d'une demande (toutes les infos : nom, téléphone +212, type de service SPP/SPE, type de prestation, type de bien, fréquence, durée, nombre d'intervenants, date/heure, ville Casablanca + quartiers, adresse, montant total, notes client)
- Le montant candidat est calculé automatiquement (montant total / 2)
- Bouton **Confirmer** pour valider une demande → elle passe au Tableau de bord
- Bouton **Rejeter** pour refuser une demande
- Liste des demandes en attente avec recherche et filtres

---

## Page 2 : Tableau de bord (Home)

Affiche les demandes **confirmées** depuis la page des demandes en attente.

### Récapitulatif en haut de page (cartes KPI)
- Nombre de demandes en cours (du jour par défaut)
- Nombre de services pour particuliers (SPP)
- Nombre de services pour entreprise (SPE)
- Nombre de demandes en attente de confirmation
- Les KPIs se mettent à jour selon les filtres appliqués

### Deux onglets : Besoins / Abonnements
- **Onglet Besoins** : toutes les demandes ponctuelles
- **Onglet Abonnements** : demandes récurrentes (filtres : fréquence, type prestation, type service)

### Affichage des demandes
- **Mode tableau/liste** : colonnes avec toutes les infos (num demande, date confirmation, nom, téléphones, type de service avec couleur SPP #0b7f7a / SPE vert citron, prestation, lieu, montant total, montant candidat, notes)
- **Mode carte** : affichage en grille, cliquer ouvre une fiche détaillée complète (adapté mobile)
- Bouton pour basculer entre les deux modes

### Actions sur chaque demande (icône crayon / 3 points)
- Éditer le besoin
- Ajouter une note (commerciale ou opérationnelle)
- Statuer : Clôturer, Standby, Supprimer, Rejeté/Annulé
- Bouton "Plus" pour voir toutes les informations du formulaire client

### Barre de recherche et filtres
- Recherche textuelle libre
- Filtre par type de service : SPP, SPE, Tous
- Filtre par période : deux calendriers pour comparer deux périodes
- Filtre par type de prestation : Ménage standard, Grand Ménage, Nettoyage Fin de chantier, Ménage post-déménagement, Ménage AirBNB, Garde malade, Ménage Bureaux, Placement...

### Bouton actualiser
- Bouton visible pour forcer le rechargement des données

---

## Notifications / Rappels 24h (in-app pour la phase 1)

- Système d'alertes in-app : badge/notification dans le back-office 24h avant chaque prestation
- Messages pré-rédigés affichés dans l'alerte :
  - **Client** : "Bonjour Madame, nous vous relançons pour confirmer votre réservation du [date], pour [type prestation]." + boutons Confirmer / Demande de report
  - **Profil** : message de confirmation ou report
  - **Opérationnel** : message de confirmation ou report
- *L'envoi WhatsApp et Email sera ajouté en phase ultérieure (nécessite intégration API)*

---

## Base de données (Lovable Cloud / Supabase)

Tables principales :
- **demandes** : toutes les informations des demandes clients (statut, infos contact, prestation, lieu, montants, notes)
- **notifications** : alertes de rappel 24h

---

## Design
- Couleur principale : #0b7f7a (vert pastel Agence Ménage)
- Badge SPP : #0b7f7a | Badge SPE : vert citron
- Interface responsive, optimisée pour mobile (mode carte par défaut sur petit écran)
- Indicatif téléphonique : +212 (Maroc)
- Villes : Casablanca avec liste de quartiers

