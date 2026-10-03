export const members = [
  {
    id: 'maya',
    name: 'Maya Chen',
    username: 'mayamakes',
    bio: 'Product designer. Making the internet feel a little more human.',
    location: 'San Francisco, CA',
    color: '#e6dfed',
    avatarUrl: '/assets/maya.svg',
  },
  {
    id: 'james',
    name: 'James Okafor',
    username: 'jamesbuilds',
    bio: 'Frontend engineer. Small details, big feelings. Currently exploring creative coding.',
    location: 'London, UK',
    color: '#e7e0d4',
    avatarUrl: '/assets/james.svg',
  },
  {
    id: 'elena',
    name: 'Elena Rivera',
    username: 'elena_r',
    bio: 'Learning in public, one commit at a time. Coffee and CSS enthusiast.',
    location: 'Medellín, Colombia',
    color: '#e8ded9',
    avatarUrl: '/assets/elena.svg',
  },
  {
    id: 'noah',
    name: 'Noah Williams',
    username: 'noahcodes',
    bio: 'Full-stack developer. Building useful things and documenting the messy middle.',
    location: 'Brooklyn, NY',
    color: '#dce5ed',
    avatarUrl: '/assets/noah.svg',
  },
  {
    id: 'sophie',
    name: 'Sophie Laurent',
    username: 'sophiel',
    bio: 'Illustrator & weekend coder. Finding inspiration in the everyday.',
    location: 'Lyon, France',
    color: '#ece6d4',
    avatarUrl: '/assets/sophie.svg',
  },
  {
    id: 'daniel',
    name: 'Daniel Park',
    username: 'danielp',
    bio: 'Backend engineer, amateur photographer. Here for good conversations.',
    location: 'Seoul, South Korea',
    color: '#dce8dc',
    avatarUrl: '/assets/daniel.svg',
  },
];
export const samplePosts = [
  {
    id: 'post-maya-1',
    authorId: 'maya',
    content:
      'A little reminder for anyone building something today: the first version doesn’t have to be the final version.\n\nMake it exist. Then make it better. 🌱',
    minutes: 24,
    likes: 24,
    comments: [
      {
        authorId: 'elena',
        content: 'Needed this today. Shipping my first full-stack project this week!',
      },
    ],
  },
  {
    id: 'post-james-1',
    authorId: 'james',
    content:
      'Closed the laptop and took the long way home. Sometimes the best debugging tool is a walk.\n\nWhat’s your go-to way to get unstuck?',
    imageUrl: '/assets/landscape.svg',
    imageAlt: 'Illustrated mountain landscape with a winding path, trees, and a setting sun',
    minutes: 53,
    likes: 38,
    comments: [
      { authorId: 'sophie', content: 'A sketchbook and a change of scenery. Works every time.' },
      {
        authorId: 'maya',
        content: 'The answer always shows up when I stop staring at the screen.',
      },
    ],
  },
  {
    id: 'post-elena-1',
    authorId: 'elena',
    content:
      'Small win: I finally understand the difference between authentication and authorization.\n\nOne asks “who are you?” The other asks “what are you allowed to do?” Writing it down here so future me remembers. #LearningInPublic',
    minutes: 96,
    likes: 19,
    comments: [
      {
        authorId: 'noah',
        content: 'The moment this clicks, backend development gets a lot less mysterious.',
      },
    ],
  },
  {
    id: 'post-noah-1',
    authorId: 'noah',
    content:
      'Built a tiny habit tracker over the weekend. No streaks. No guilt. Just a gentle record of showing up.\n\nNot every app needs to gamify your life.',
    minutes: 155,
    likes: 42,
    comments: [],
  },
  {
    id: 'post-sophie-1',
    authorId: 'sophie',
    content:
      'Collecting little things that made this week better:\n\n→ A handwritten note\n→ Someone explaining a concept without making me feel silly\n→ A really good playlist\n\nYour turn. What’s on your list?',
    minutes: 225,
    likes: 31,
    comments: [
      {
        authorId: 'daniel',
        content: 'That one pull request review that actually teaches you something.',
      },
    ],
  },
  {
    id: 'post-daniel-1',
    authorId: 'daniel',
    content:
      'Database indexes are a lot like bookmarks in a real book. You could flip through every page… or just go straight to the thing you need.\n\nToday’s tiny optimization made a query 20× faster. Always measure before you guess.',
    minutes: 340,
    likes: 17,
    comments: [],
  },
  {
    id: 'post-maya-2',
    authorId: 'maya',
    content:
      'Good design leaves a little room to breathe. Been thinking about this a lot while simplifying an onboarding flow.\n\nWhat’s one interface that makes you feel calm?',
    minutes: 550,
    likes: 22,
    comments: [],
  },
  {
    id: 'post-james-2',
    authorId: 'james',
    content: 'Today I removed more code than I wrote. Counting that as progress. #BuildInPublic',
    minutes: 750,
    likes: 29,
    comments: [],
  },
];
