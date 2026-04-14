

## Plan : Réorganiser le tableau du Dashboard pour tenir sur une seule page

### Objectif
Réduire le nombre de colonnes, abréger les titres, et réordonner selon les 13 colonnes demandées — sans défilement horizontal.

### Colonnes actuelles → Nouvelles colonnes (dans l'ordre)

| # | Nouvelle colonne | Titre affiché | Notes |
|---|---|---|---|
| 1 | Actions | Icône ⚙️ uniquement (pas de texte "Actions") | Garder le dropdown existant |
| 2 | Commercial | **Com** | Abrégé |
| 3 | Date intervention | **Date** | Abrégé, format compact dd/MM/yy |
| 4 | Statut du besoin | **Statut** | Badge existant |
| 5 | Nom du client | **Client** | Cliquable → redirige vers `/compte-client?id=...` |
| 6 | Quartier/Ville | **Lieu** | Compact sur une ligne |
| 7 | Type de service | **Service** | Texte prestation |
| 8 | Segment | **Seg.** | Badge SPP/SPE |
| 9 | Nb d'heures | **Hrs** | Abrégé |
| 10 | Profils envoyés | **Profil** | Cliquable → redirige vers `/compte-profil?id=...` |
| 11 | Option supplémentaire | **Opt. sup.** | Remplace "Avec produit" |
| 12 | CAO | **CAO** | Inchangé |
| 13 | Tarif total | **Tarif** | Montant MAD |

### Colonnes supprimées
- Fréquence
- Mode paiement
- Statut paiement
- Reste à payer
- Colonne vide du menu 3 points (intégré dans Actions ou conservé en dernière colonne discrète)

### Modifications techniques

**Fichier : `src/pages/Dashboard.tsx`**

1. **TableHeader** (lignes ~402-422) : Remplacer les 18 colonnes par les 13 listées ci-dessus avec titres abrégés. Ajouter `className="text-xs"` sur tous les `TableHead` pour compacité.

2. **TableBody / renderTable** (lignes ~427-525) : Réordonner les `TableCell` selon le nouvel ordre. Supprimer les cellules Fréquence, Mode paiement, Statut paiement, Reste à payer.

3. **Actions** : Remplacer le bouton texte "Actions" par une icône seule (`<Settings className="h-4 w-4" />`).

4. **Nom du client** : Rendre cliquable avec `onClick={() => openCompteClient(d)}` (déjà existant).

5. **Profils envoyés** : Rendre le nom cliquable pour naviguer vers `/compte-profil?id={profil_id}`. Chercher le profil_id depuis la table `profils` par nom si nécessaire.

6. **Option supplémentaire** : Renommer le champ `avec_produit` en affichage "Opt. sup." avec le même badge Oui/Non.

7. **Menu 3 points** : Fusionner dans la colonne Actions ou le garder en dernière colonne sans titre.

8. **colSpan** : Mettre à jour le `colSpan` de la ligne vide (actuellement 18) vers 13.

9. **Styles compacts** : Ajouter `text-xs` et `px-2` sur les cellules pour réduire la largeur globale.

