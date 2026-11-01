// Reading passages for the speed test, graded by CEFR level.
//
// All passages are original. Writing guidelines per level (after the CEFR
// reading descriptors):
//   A2  ~90–120 words. Very common everyday vocabulary, short sentences,
//       present/past simple. Concrete topics (home, work, travel).
//       Questions: find a stated fact.
//   B1  ~120–150 words. Familiar topics, linked sentences (however, so,
//       because), past continuous/perfect, simple opinions.
//       Questions: facts and the main point.
//   B2  ~130–180 words. Abstract or general-interest topics, argument and
//       counter-argument, passives, less common vocabulary.
//       Questions: main idea, detail, meaning from context.
//   C1  ~145–200 words. Nuanced argument, idiomatic and academic vocabulary,
//       hedging. Questions: inference, implication, writer's attitude.
//
// Word counts are this project's own targets (CEFR doesn't prescribe any);
// tests/passages.test.ts checks them, and checks that rare-word share, mean
// word difficulty and sentence length all rise from level to level.
//
// Every question can be answered from the passage alone, not from general
// knowledge. The correct answer is always listed first in `options`; the UI
// shuffles them.

export type Level = 'A2' | 'B1' | 'B2' | 'C1';

export const LEVELS: Level[] = ['A2', 'B1', 'B2', 'C1'];

export type Question = { q: string; options: [string, string, string, string] };

export type Passage = {
  id: string;
  level: Level;
  title: string;
  text: string;
  questions: [Question, Question, Question];
};

export const LEVEL_INFO: Record<Level, { name: string; canDo: string }> = {
  A2: { name: 'Elementary', canDo: 'I can read short, simple texts about everyday things.' },
  B1: { name: 'Intermediate', canDo: 'I can understand texts about familiar topics, like work, school or travel.' },
  B2: { name: 'Upper intermediate', canDo: 'I can read articles and understand the main ideas, even on harder topics.' },
  C1: { name: 'Advanced', canDo: 'I can read long, complex texts and understand what the writer means, not only what they say.' },
};

export const PASSAGES: Passage[] = [
  // ---------------------------------------------------------------- A2 ----
  {
    id: 'a2-bakery',
    level: 'A2',
    title: 'A new job',
    text: `Maria is twenty-four years old. She lives in a small flat near the river with her cat, Pepper. Last month, Maria started a new job at a bakery in the town centre. She works there five days a week, from Tuesday to Saturday. Her day starts very early, at five o'clock in the morning. First, she makes bread. Then she makes cakes and cookies. Maria loves the smell of fresh bread. The bakery opens at seven, and many people come in before work. Maria is often tired in the afternoon, but she is happy. On Sundays and Mondays, she sleeps late and visits her parents.`,
    questions: [
      { q: 'Where does Maria work?', options: ['At a bakery', 'At a café', 'At a supermarket', 'At a restaurant'] },
      { q: 'What time does her day start?', options: ["At five o'clock", "At seven o'clock", "At six o'clock", "At eight o'clock"] },
      {
        q: 'What does Maria do on Sundays?',
        options: ['She sleeps late and visits her parents', 'She works at the bakery', 'She makes cakes at home', 'She walks by the river with Pepper'],
      },
    ],
  },
  {
    id: 'a2-bag',
    level: 'A2',
    title: 'The lost bag',
    text: `Last Friday, Tom took the bus home from school. He was very tired, and he fell asleep. When he woke up, the bus was at his stop! He jumped up and ran off the bus. At home, he looked for his bag. It wasn't there. His books, his phone and his lunch box were all in the bag. Tom felt terrible. His mother called the bus company. A woman answered and said, "Yes, we have a blue bag here." The next morning, Tom and his mother went to the bus station. Tom got his bag back. Nothing was missing, but his sandwich was very old!`,
    questions: [
      {
        q: 'Why did Tom leave his bag on the bus?',
        options: ['He fell asleep and had to get off quickly', 'He was talking on his phone', 'He got off at the wrong stop', 'He gave it to a friend'],
      },
      { q: 'Who called the bus company?', options: ["Tom's mother", 'Tom', "Tom's teacher", 'A woman from the bus'] },
      { q: 'What colour was the bag?', options: ['Blue', 'Black', 'Red', 'Green'] },
    ],
  },
  {
    id: 'a2-garden',
    level: 'A2',
    title: "My grandmother's garden",
    text: `My grandmother is seventy-eight, and she has a big garden behind her house. Every summer, I stay with her for two weeks. In the morning, we work in the garden together. We grow tomatoes, beans, potatoes and lots of flowers. My grandmother knows the name of every plant. In the afternoon, it is too hot to work outside, so we sit in the kitchen and play cards. She always wins! In the evening, we cook dinner with vegetables from the garden. Food from the garden tastes better than food from the shop. I want to have a garden like hers one day.`,
    questions: [
      { q: 'How long does the writer stay with their grandmother?', options: ['Two weeks', 'One week', 'All summer', 'One month'] },
      { q: 'What do they do in the afternoon?', options: ['Play cards in the kitchen', 'Work in the garden', 'Go to the shop', 'Cook dinner'] },
      {
        q: 'Which sentence about the grandmother is true?',
        options: ['She knows the name of every plant', 'She often loses at cards', 'She buys her vegetables from the shop', 'She lives in a flat'],
      },
    ],
  },
  {
    id: 'a2-mountains',
    level: 'A2',
    title: 'A weekend in the mountains',
    text: `Last weekend, Ben and his friend Sam went to the mountains. They took the train on Saturday morning. The journey was three hours long. In the afternoon, they walked up a hill near the village. The weather was sunny and warm, and they saw some goats. They stayed in a small hotel. The food there was very good. On Sunday, it rained all day, so they visited a museum about the history of the village. Then they went to a café and drank hot chocolate. They took the train home in the evening. Ben wants to go back in the winter.`,
    questions: [
      { q: 'How did Ben and Sam travel to the mountains?', options: ['By train', 'By car', 'By bus', 'By bike'] },
      { q: 'What was the weather like on Sunday?', options: ['It rained all day', 'It was sunny and warm', 'It snowed', 'It was windy but dry'] },
      {
        q: 'What did they do on Sunday?',
        options: ['They visited a museum and went to a café', 'They walked up a hill', 'They looked at goats', 'They stayed in the hotel all day'],
      },
    ],
  },
  {
    id: 'a2-neighbours',
    level: 'A2',
    title: 'The new neighbours',
    text: `A new family moved into the house next to ours in March. There is a mother, a father and two children, a boy and a girl. The boy is eight, the same age as my brother. On their first day, my mother made a cake and we took it to them. They were very happy. The father is a doctor at the hospital, and the mother is a music teacher. Now the girl comes to our house on Wednesdays, and my mother teaches her to swim. Every Saturday, my brother and the boy play football in the park. They are good friends now.`,
    questions: [
      { q: 'When did the new family move in?', options: ['In March', 'In May', 'On a Wednesday', 'On a Saturday'] },
      { q: "What is the new mother's job?", options: ['She is a music teacher', 'She is a doctor', 'She is a swimming teacher', 'She is a cook'] },
      {
        q: 'What happens every Saturday?',
        options: ['The two boys play football in the park', 'The girl has a swimming lesson', 'The families eat cake together', 'The father works at the hospital'],
      },
    ],
  },
  {
    id: 'a2-morning',
    level: 'A2',
    title: 'A busy morning',
    text: `Anna's alarm did not ring this morning. She woke up at half past eight, and her English class starts at nine! She got dressed very quickly and did not eat breakfast. She ran to the bus stop, but the bus was late. So she decided to walk. It took twenty-five minutes. When she arrived at the school, the door of the classroom was closed. She opened it slowly. The room was empty! Then she remembered: today is a holiday, and there are no classes. Anna laughed, went to a café and had a big breakfast.`,
    questions: [
      { q: 'Why did Anna wake up late?', options: ['Her alarm did not ring', 'She went to bed very late', 'She was ill', 'She was on holiday'] },
      { q: 'How did Anna get to school?', options: ['She walked', 'She took the bus', 'She took a taxi', 'A friend drove her'] },
      {
        q: 'Why was the classroom empty?',
        options: ['It was a holiday', 'Anna arrived too late', 'The class was in another room', 'The teacher was ill'],
      },
    ],
  },

  // ---------------------------------------------------------------- B1 ----
  {
    id: 'b1-cooking',
    level: 'B1',
    title: 'Learning to cook',
    text: `When I left home to go to university, I couldn't cook at all. For the first few weeks, I lived on sandwiches and instant noodles, and I started to feel tired all the time. One evening, I phoned my dad and asked him for some simple recipes. He sent me five, and he told me to start with the easiest one: a vegetable soup. My first attempt was a disaster because I added far too much salt. However, I didn't give up. By the end of the term, I could make all five dishes, and I was even inviting friends round for dinner. Now I actually enjoy cooking. It helps me relax after a long day of studying, and it's much cheaper than eating out.`,
    questions: [
      {
        q: 'Why did the writer decide to learn to cook?',
        options: ['They felt tired from eating badly', 'Their friends wanted dinner parties', 'It was part of their university course', 'The university café closed'],
      },
      {
        q: 'What went wrong the first time?',
        options: ['The soup had too much salt in it', 'The soup was burned', 'They forgot the vegetables', "Their dad's recipe was wrong"],
      },
      {
        q: 'How does the writer feel about cooking now?',
        options: ['They enjoy it and find it relaxing', 'They still find it very difficult', 'They only cook when friends visit', 'They think it is too expensive'],
      },
    ],
  },
  {
    id: 'b1-photo',
    level: 'B1',
    title: 'The photography club',
    text: `Last year, our town library started a free photography club for teenagers. It meets every Thursday after school. At first, only six people came, but now there are more than twenty members. The club leader, Mr Okafor, used to work as a photographer for a newspaper. He believes that you don't need an expensive camera to take good photos. In fact, most members just use their phones. Each month, the club chooses a theme, such as "water" or "people at work", and everyone goes out to take pictures. At the end of the year, the best photos were shown in an exhibition at the library. Since then, several local shops have asked the club to take photos for their websites.`,
    questions: [
      {
        q: 'What was Mr Okafor’s job in the past?',
        options: ['He took photos for a newspaper', 'He worked in the library', 'He sold cameras', 'He was a school teacher'],
      },
      {
        q: 'What does Mr Okafor believe?',
        options: ["You don't need an expensive camera to take good photos", 'Only professional cameras take good photos', 'Teenagers should not use their phones', 'Every photo should have a theme'],
      },
      {
        q: 'What have some local shops done?',
        options: ['Asked the club to take photos for their websites', 'Bought photos from the exhibition', 'Given the club new cameras', 'Paid for the exhibition'],
      },
    ],
  },
  {
    id: 'b1-home',
    level: 'B1',
    title: 'Working from home',
    text: `When Daniel's company told everyone they could work from home, he was delighted. He would save two hours a day on travelling, and he could wear whatever he liked. For the first month, everything was great. But slowly, he began to notice some problems. He found it difficult to stop working in the evening, because his laptop was always on the kitchen table. He also missed chatting with his colleagues, and he felt lonely. In the end, Daniel made some changes. He set up a small desk in the spare room and closed the door at six o'clock every evening. He also started going into the office on Tuesdays and Thursdays. Now he feels he has the best of both worlds.`,
    questions: [
      {
        q: 'Why was Daniel happy at first?',
        options: ['He could save time and wear what he liked', 'He was going to earn more money', 'He liked working in the kitchen', "He didn't like his colleagues"],
      },
      {
        q: 'Which problem did Daniel have?',
        options: ['He found it hard to stop working in the evening', 'His laptop stopped working', 'His manager checked on him all the time', 'His home was too far from the shops'],
      },
      {
        q: 'What does "the best of both worlds" mean here?',
        options: ['He has the good parts of working at home and in the office', 'He has two different jobs', 'He lives in two different cities', 'He now prefers the office'],
      },
    ],
  },
  {
    id: 'b1-lanterns',
    level: 'B1',
    title: 'A festival of lights',
    text: `Every November, the small town of Kellan holds a lantern festival. The tradition started about fifty years ago, when the town lost its electricity for a whole week during a storm. People put candles in jars and hung them outside their homes so that neighbours could find their way in the dark. Today, the festival lasts for three nights. Children make paper lanterns at school, and on the last night everyone walks through the streets carrying them. There is music in the main square, and local restaurants sell hot soup. Some people say the festival has become too commercial, because tourists now arrive by the busload. Most residents, however, are proud that their small town has become famous.`,
    questions: [
      {
        q: 'How did the tradition begin?',
        options: ['A storm cut the electricity, so people hung candles outside', 'A famous visitor brought lanterns to the town', 'A shop started selling lanterns', 'Children made lanterns for a school project'],
      },
      {
        q: 'What happens on the last night?',
        options: ['Everyone walks through the streets with lanterns', 'Children make lanterns at school', 'The restaurants close early', 'The tourists go home'],
      },
      {
        q: 'What do some people complain about?',
        options: ['The festival has become too commercial', 'The festival is too short', 'The weather is too cold', 'The soup is too expensive'],
      },
    ],
  },
  {
    id: 'b1-shelter',
    level: 'B1',
    title: 'Volunteering at the animal shelter',
    text: `I started volunteering at an animal shelter when I was sixteen. My parents wouldn't let me have a dog, so I thought it would be a good way to spend time with animals. I expected to play with puppies all day, but the reality was quite different. Most of my time was spent cleaning cages, washing bowls and walking older dogs that nobody wanted to adopt. Some days were sad, especially when an animal had been badly treated. Even so, I kept going every Saturday for three years. The experience taught me to be patient and responsible. It also helped me decide what I wanted to do with my life: next year, I'm starting a course to become a vet.`,
    questions: [
      {
        q: 'Why did the writer start volunteering?',
        options: ["Their parents wouldn't let them have a dog", 'Their school told them to', 'They wanted to earn some money', 'A friend already worked there'],
      },
      {
        q: 'How was the work different from what the writer expected?',
        options: ['It was mostly cleaning and walking older dogs', 'They had to work every day', 'There were no dogs at the shelter', 'They only played with puppies'],
      },
      {
        q: 'What is the writer going to do next year?',
        options: ['Start a course to become a vet', 'Adopt an older dog', 'Work full-time at the shelter', 'Open their own shelter'],
      },
    ],
  },
  {
    id: 'b1-train',
    level: 'B1',
    title: 'The long way round',
    text: `Last spring, my sister and I decided to travel across the country by train instead of flying. Everyone told us we were crazy, because the journey would take two days instead of two hours. But we wanted to see the landscape properly. We booked a small sleeping cabin with two narrow beds. During the day, we watched forests, lakes and tiny villages pass by the window. We ate in the restaurant car, where we met an elderly man who had worked on the railway for forty years. He told us amazing stories about the line's history. The second night was uncomfortable because the train kept stopping. Still, when we finally arrived, we agreed that it had been the best part of our holiday.`,
    questions: [
      {
        q: 'Why did the sisters choose the train?',
        options: ['They wanted to see the landscape properly', 'It was cheaper than flying', 'They were afraid of flying', 'There were no flights'],
      },
      {
        q: 'Who did they meet in the restaurant car?',
        options: ['A man who had worked on the railway for years', 'A famous photographer', 'A travel writer', 'Their cousin'],
      },
      {
        q: 'Why was the second night uncomfortable?',
        options: ['The train kept stopping', 'The beds were too narrow', 'The restaurant car was closed', 'The cabin was too cold'],
      },
    ],
  },

  // ---------------------------------------------------------------- B2 ----
  {
    id: 'b2-procrastination',
    level: 'B2',
    title: 'Why we put things off',
    text: `Most people assume that procrastination is simply a matter of laziness or poor time management. However, many psychologists now argue that it is primarily an emotional problem. According to this view, we put off tasks not because we are unwilling to work, but because the task makes us feel anxious, bored or insecure. Delaying it offers a brief sense of relief, which is exactly why the habit is so hard to break: the reward comes immediately, while the cost arrives later. If this explanation is correct, then strategies such as making detailed schedules may not be enough on their own. Researchers suggest that it may be more effective to deal with the feelings themselves, for example by breaking an intimidating task into smaller steps or by being less self-critical after a setback. Interestingly, people who forgive themselves for procrastinating tend to procrastinate less the next time.`,
    questions: [
      {
        q: 'What is the main idea of the text?',
        options: ['Procrastination is often about emotions rather than laziness', 'Procrastination is caused by poor time management', 'Detailed schedules are the best solution', 'Only anxious people procrastinate'],
      },
      {
        q: 'Why is the habit hard to break, according to the text?',
        options: ['The relief is immediate but the cost comes later', 'People enjoy being busy', 'Most tasks are too easy', 'Schedules are confusing'],
      },
      {
        q: 'What does the text say about forgiving yourself?',
        options: ['It is linked to procrastinating less next time', 'It makes people lazier', 'It has no effect at all', 'It only works together with a schedule'],
      },
    ],
  },
  {
    id: 'b2-fourday',
    level: 'B2',
    title: 'The four-day week',
    text: `When a mid-sized software company introduced a four-day working week, many observers predicted that productivity would fall. Staff kept the same salary but worked thirty-two hours instead of forty. Six months later, the results surprised even the company's directors. Output had remained stable, sick days had dropped by almost a third, and far fewer employees were leaving for other jobs. Managers put this down partly to shorter, more focused meetings, which had become necessary once everyone had less time. Not everything went smoothly, though. The customer support team struggled at first, since clients still expected help on Fridays. The company eventually solved this by giving support staff a rotating day off instead. The directors admit that the model might not suit every industry, but they have no plans to return to a five-day week.`,
    questions: [
      {
        q: 'What happened to the amount of work produced?',
        options: ['It stayed about the same', 'It fell sharply', 'It doubled', 'It was not measured'],
      },
      {
        q: 'Why did the customer support team have problems?',
        options: ['Clients still expected help on Fridays', 'They had too many meetings', 'Many of them left the company', 'Their salaries were cut'],
      },
      {
        q: "What is the directors' attitude to the four-day week?",
        options: ['Positive, though it may not suit every industry', 'They regret introducing it', 'They think every company should do it', 'They plan to return to five days soon'],
      },
    ],
  },
  {
    id: 'b2-trees',
    level: 'B2',
    title: 'Trees in the city',
    text: `City planners have traditionally treated trees as decoration, something pleasant to add once roads and buildings were in place. That attitude is changing. A growing body of research shows that urban trees provide practical benefits that are difficult to achieve in other ways. During heatwaves, streets lined with mature trees can be several degrees cooler than nearby streets without them, partly because of shade and partly because leaves release water vapour. Trees also absorb rainwater, reducing the risk of flooding, and some studies have linked green streets to lower stress levels among residents. Yet planting trees is not as simple as it sounds. Young trees need regular watering for several years, and roots can damage pipes and pavements if the wrong species is chosen. Experts therefore argue that what matters is not just how many trees a city plants, but how carefully they are selected and maintained.`,
    questions: [
      {
        q: 'How has the attitude of city planners changed?',
        options: ['Trees are now seen as practical, not just decoration', 'Trees are now seen only as decoration', 'Planners now prefer to remove trees', 'Cities have stopped planting trees'],
      },
      {
        q: 'Why can streets with trees be cooler?',
        options: ['Because of shade and water released by leaves', 'Because trees absorb rainwater', 'Because there is less traffic', 'Because buildings reflect the sun'],
      },
      {
        q: "What is the experts' main point?",
        options: ['Choosing and caring for trees matters, not only the number', 'Cities should plant as many trees as possible', 'Trees cause more problems than they solve', 'Only old trees are useful'],
      },
    ],
  },
  {
    id: 'b2-language',
    level: 'B2',
    title: 'Learning a language as an adult',
    text: `It is often said that children learn languages more easily than adults, and in some respects this is true. Children who grow up with a second language usually end up with a more native-like accent. However, the picture is more complicated than the popular belief suggests. In the early stages, adults and older children often make faster progress than young children, because they can use their knowledge of grammar, apply learning strategies and study deliberately. What young children have on their side is time: they are typically exposed to the language for many years, often in situations where they need it to make friends or follow lessons. For adult learners, the lesson is encouraging. Although a perfect accent may be unrealistic for most, becoming a fluent and accurate speaker is entirely possible, provided that learners get enough meaningful practice over a long period.`,
    questions: [
      {
        q: 'Which advantage do young children usually have?',
        options: ['They end up with a more native-like accent', 'They learn grammar faster', 'They use better learning strategies', 'They study more deliberately'],
      },
      {
        q: 'Why do adults often make faster progress at first?',
        options: ['They can use grammar knowledge and study on purpose', 'They have more free time', 'They need the language to make friends', 'They have a better memory'],
      },
      {
        q: "What is the writer's conclusion?",
        options: ['Adults can become fluent with enough practice', 'Adults should not try to become fluent', 'Only children can really learn a language', 'A perfect accent is the most important goal'],
      },
    ],
  },
  {
    id: 'b2-repair',
    level: 'B2',
    title: 'The return of repair',
    text: `For decades, it has often been cheaper to replace a broken appliance than to fix it. Spare parts were hard to find, manuals were rarely published, and some products were deliberately glued shut. Recently, however, a "right to repair" movement has gained momentum. Campaigners argue that consumers should be able to fix the things they own, either themselves or through independent repair shops, rather than being forced to return to the manufacturer. Their arguments are partly economic and partly environmental: electronic waste is one of the fastest-growing types of rubbish in the world. Several governments have responded with laws requiring manufacturers to make spare parts and repair information available for a number of years. Manufacturers have raised concerns about safety and security, pointing out that poorly carried out repairs could cause accidents. Nevertheless, the trend suggests that repair is becoming a normal part of owning a product once again.`,
    questions: [
      {
        q: 'What do the campaigners want?',
        options: ['People to be able to fix what they own', 'A ban on new electronic products', 'Free replacements for broken products', 'Manufacturers to stop making electronics'],
      },
      {
        q: 'What concern have manufacturers raised?',
        options: ['Badly done repairs could cause accidents', 'The new laws are too expensive', 'Customers do not want repairs', 'Spare parts are too difficult to make'],
      },
      {
        q: 'In this text, "gained momentum" means…',
        options: ['become stronger and more popular', 'met strong opposition', 'raised a lot of money', 'become a law'],
      },
    ],
  },
  {
    id: 'b2-sleep',
    level: 'B2',
    title: 'Sleep and memory',
    text: `Scientists have long suspected that sleep plays an important role in memory, and research over the past few decades has largely confirmed this. During sleep, the brain appears to replay and strengthen information acquired during the day, transferring some of it into longer-term storage. In one common type of experiment, participants learn a list of words or a simple skill, and are then tested after a period of either sleep or wakefulness. Those who have slept generally perform better, even when the length of time between learning and testing is the same. This has practical consequences for students. Staying up all night before an exam may provide extra hours of revision, but it may also prevent the brain from consolidating what was learned. Spreading study over several days, with proper sleep in between, is likely to be far more effective than a single, exhausting session.`,
    questions: [
      {
        q: 'What does the brain seem to do during sleep?',
        options: ['Replay and strengthen what was learned that day', 'Completely forget unimportant information', 'Learn new words', 'Rest without any activity'],
      },
      {
        q: 'In the experiments, what is the same for both groups?',
        options: ['The time between learning and the test', 'The amount of sleep they get', 'Their test results', 'Their age'],
      },
      {
        q: 'What advice does the text suggest for students?',
        options: ['Study over several days and sleep well', 'Study all night before an exam', 'Sleep instead of studying', 'Do one long study session'],
      },
    ],
  },

  // ---------------------------------------------------------------- C1 ----
  {
    id: 'c1-choice',
    level: 'C1',
    title: 'Too much choice?',
    text: `It seems self-evident that having more options should make us happier: the more choice we have, the more likely we are to find exactly what we want. Yet a number of researchers have challenged this assumption. In a frequently cited study, shoppers presented with a large array of jams were more likely to stop and look, but considerably less likely to buy anything, than those offered only a handful. The proposed explanation is that an abundance of options raises our expectations while simultaneously increasing the effort required to choose, leaving us more prone to regret whichever option we eventually settle on. It would be premature, however, to conclude that choice is inherently harmful. Subsequent attempts to replicate such findings have produced mixed results, and the effect seems to depend heavily on context, including how much the decision matters and how well people already understand their own preferences. The more modest lesson, perhaps, is that choice is not an unalloyed good, and that its benefits have limits.`,
    questions: [
      {
        q: 'What did the jam study suggest?',
        options: ['A large selection attracted attention but led to fewer purchases', 'A large selection led to more jam being sold', 'Shoppers ignored the large selection', 'Shoppers regretted choosing from the small selection'],
      },
      {
        q: "What is the writer's overall position?",
        options: ['Choice has benefits, but they are limited and depend on context', 'Choice is always harmful', 'More choice always makes people happier', 'The jam study settled the question'],
      },
      {
        q: '"Not an unalloyed good" means that choice is…',
        options: ['not entirely positive', 'completely useless', 'always harmful', 'too expensive'],
      },
    ],
  },
  {
    id: 'c1-boredom',
    level: 'C1',
    title: 'In defence of boredom',
    text: `In an age when a smartphone can banish a moment of idleness in seconds, boredom has acquired a reputation as something to be eliminated at all costs. Some psychologists, however, contend that we may be discarding something of value. Boredom, they argue, is not merely an absence of stimulation but a signal, an uncomfortable nudge that our current activity is failing to engage us and that we ought to seek something more meaningful. Seen in this light, constantly reaching for a distraction is rather like silencing an alarm without checking what triggered it. There is also tentative evidence that mild boredom can foster creativity: in a few experiments, participants who had first completed a deliberately tedious task went on to produce more inventive ideas than those who had not. Such findings should be treated with caution, as the studies are small and the effects modest. Still, they raise an awkward question about whether our determination never to be bored comes at a hidden price.`,
    questions: [
      {
        q: 'How do some psychologists see boredom?',
        options: ['As a signal to look for something more meaningful', 'As something harmful to avoid', 'As a problem caused by smartphones', 'As a sign of low intelligence'],
      },
      {
        q: 'What does the comparison with an alarm suggest?',
        options: ['Distracting ourselves ignores what boredom is telling us', 'Phones are too noisy', 'Boredom is dangerous', 'We should use more alarms'],
      },
      {
        q: "What is the writer's attitude to the evidence about creativity?",
        options: ['Interested but cautious, because the studies are small', 'Completely convinced by it', 'Dismissive of it', 'Angry about it'],
      },
    ],
  },
  {
    id: 'c1-translation',
    level: 'C1',
    title: 'Lost in translation',
    text: `Anyone who has tried to translate a joke knows that meaning does not travel from one language to another intact. Translation is often imagined as a mechanical process of substituting one word for its equivalent, but experienced translators describe it as something closer to rewriting. A single word may carry associations, a particular rhythm or a level of formality that has no exact counterpart in the target language, forcing the translator to decide which of these qualities to preserve and which to sacrifice. Poetry is the most notorious example, since sound and sense are inseparable, but even an apparently straightforward business email can pose dilemmas: a phrase that sounds polite in one culture may come across as cold or even rude in another. Machine translation has become remarkably fluent at the level of the sentence, yet it still tends to stumble over precisely these subtleties of tone and implication. For that reason, many professionals now see their role as shifting from producing translations to refining them.`,
    questions: [
      {
        q: 'How do experienced translators describe their work?',
        options: ['As closer to rewriting than replacing words', 'As a mechanical process', 'As easy when the text is a business email', 'As mostly about poetry'],
      },
      {
        q: 'Why can a business email be difficult to translate?',
        options: ['What sounds polite in one culture may seem rude in another', 'Business emails often contain poetry', 'Business emails are usually very long', 'Business emails use technical words'],
      },
      {
        q: 'What does the last sentence suggest?',
        options: ['Translators increasingly improve machine translations', 'Human translators are no longer needed', 'Machine translation is getting worse', 'Translators now prefer to translate poetry'],
      },
    ],
  },
  {
    id: 'c1-citizen',
    level: 'C1',
    title: 'Citizen science',
    text: `Not long ago, scientific research was largely the preserve of professionals working in universities and laboratories. Today, millions of volunteers contribute to genuine research projects, classifying galaxies from telescope images, recording bird sightings in their gardens or transcribing handwritten historical documents. This so-called citizen science has proved invaluable in fields where the sheer volume of data would overwhelm any single research team. Volunteers have even been credited with discoveries, such as unusual astronomical objects that automated systems had overlooked. Sceptics initially questioned whether data gathered by amateurs could be trusted. In practice, projects tend to build in safeguards: several volunteers may examine the same item, and their answers are compared before anything is accepted. There are subtler concerns, too, notably whether volunteers are adequately acknowledged when their efforts lead to published findings. Nonetheless, the model has blurred the boundary between those who do science and those who merely read about it, which many regard as an achievement in itself.`,
    questions: [
      {
        q: 'Why is citizen science especially useful in some fields?',
        options: ['There is too much data for one research team', 'Volunteers have better equipment', 'Professionals lack the necessary skills', 'It replaces automated systems completely'],
      },
      {
        q: 'How do projects make sure the data can be trusted?',
        options: ['Several volunteers check the same item and answers are compared', 'Only professionals check the data', 'Volunteers have to pass an exam', 'The data is never published'],
      },
      {
        q: 'Which further concern does the text mention?',
        options: ['Whether volunteers get enough credit for their work', 'Whether volunteers are paid too much', 'Whether projects are too slow', 'Whether volunteers enjoy the work'],
      },
    ],
  },
  {
    id: 'c1-nostalgia',
    level: 'C1',
    title: 'The uses of nostalgia',
    text: `For much of history, nostalgia was regarded not as a pleasant feeling but as an illness. The term was coined by a Swiss medical student in the seventeenth century to describe the severe homesickness suffered by soldiers serving far from home, and for a long time it was associated with melancholy and even physical decline. Contemporary psychologists take a markedly different view. Research suggests that nostalgia, far from being a sign of weakness, often serves a protective function. When people feel lonely, anxious or uncertain about the future, recalling cherished memories appears to strengthen their sense of connection to others and their conviction that life is meaningful. That is not to say that nostalgia is invariably beneficial; dwelling on an idealised past can make the present seem disappointing by comparison. On balance, though, the emotion seems less a retreat from reality than a resource that people draw on to cope with it.`,
    questions: [
      {
        q: 'How was nostalgia originally understood?',
        options: ['As an illness linked to homesickness', 'As a pleasant feeling', 'As a sign of intelligence', 'As a military tradition'],
      },
      {
        q: 'According to recent research, when does nostalgia help people?',
        options: ['When they feel lonely, anxious or uncertain', 'Only when they are already happy', 'Only in old age', 'Only when they are far from home'],
      },
      {
        q: 'What does the last sentence mean?',
        options: ['Nostalgia helps people face reality rather than escape it', 'Nostalgia is a way of escaping reality', 'Nostalgia should be avoided', 'The present is usually disappointing'],
      },
    ],
  },
  {
    id: 'c1-office',
    level: 'C1',
    title: 'The open-plan office',
    text: `Few workplace trends have spread as rapidly, or attracted as much criticism, as the open-plan office. Its advocates promised that removing walls and partitions would encourage spontaneous conversation, break down hierarchies and foster collaboration. The financial argument was hardly a secondary consideration either: open layouts allow companies to accommodate more staff in less space. Yet the evidence for the promised benefits is surprisingly thin. One widely discussed study, which tracked employees as their company moved into an open-plan space, found that face-to-face interaction actually decreased substantially, while email and instant messaging increased. Workers, it seems, responded to the lack of privacy by withdrawing, putting on headphones and communicating digitally instead. None of this means that walls should simply be rebuilt. Many organisations are now experimenting with a mixture of quiet zones, small meeting rooms and shared areas, acknowledging that different kinds of work call for different environments.`,
    questions: [
      {
        q: 'Apart from collaboration, what else motivated open-plan offices?',
        options: ['Fitting more staff into less space', 'Improving workers’ health', 'Making offices quieter', 'Attracting younger workers'],
      },
      {
        q: 'What did the study find?',
        options: ['People talked face to face less and messaged more', 'People talked face to face much more', 'Productivity doubled', 'Most workers left the company'],
      },
      {
        q: "What is the writer's conclusion?",
        options: ['Different kinds of work need different spaces', 'Companies should go back to private offices', 'Open-plan offices are ideal', 'Everyone should work from home'],
      },
    ],
  },
];

export function passagesFor(level: Level): Passage[] {
  return PASSAGES.filter((p) => p.level === level);
}
