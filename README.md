# Parla

Application PWA statique pour GitHub Pages afin d'apprendre l'italien.

## Déploiement

1. Placez tous les fichiers à la racine de votre dépôt GitHub Pages.
2. Vérifiez que `index.html` est servi depuis la racine du site.
3. Le service worker activera le mode hors ligne après le premier chargement.

## Sauvegarde utilisateur

L'application utilise deux mécanismes complémentaires :

- persistance automatique dans `localStorage`
- export manuel d'un fichier JSON réimportable

Exemple de structure exportée :

```json
{
  "app": "Parla",
  "version": 1,
  "exportedAt": "2026-04-17T09:00:00.000Z",
  "state": {
    "profile": {
      "xp": 120,
      "level": 2,
      "streak": 3,
      "lastStudyDate": "2026-04-17",
      "completedLessons": ["basics-1"],
      "masteredCards": [],
      "history": []
    },
    "review": {},
    "settings": {
      "soundEnabled": true
    },
    "dailyProgress": {
      "date": "2026-04-17",
      "lessonsCompletedToday": 1,
      "reviewDoneToday": 0,
      "quizDoneToday": 0
    }
  }
}
```

## Ajouter des leçons

Modifiez `data/lessons.json` en respectant cette structure :

```json
{
  "id": "travel-2",
  "title": "Commander au restaurant",
  "description": "Expressions utiles pour commander et demander l'addition.",
  "difficulty": "Intermédiaire",
  "xp": 70,
  "expressions": [
    {
      "it": "Il conto, per favore",
      "fr": "L'addition, s'il vous plaît",
      "phonetic": "il kon-to, per fa-vo-ré",
      "example": "Scusi, il conto, per favore."
    }
  ],
  "practice": [
    {
      "prompt": "Traduisez en italien : L'addition, s'il vous plaît",
      "answer": "il conto, per favore",
      "altAnswers": ["il conto per favore"]
    }
  ]
}
```
