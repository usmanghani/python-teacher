import flower from '../../examples/flower.py?raw'
import house from '../../examples/house.py?raw'
import rainbowSpiral from '../../examples/rainbow-spiral.py?raw'
import rocketLaunch from '../../examples/rocket-launch.py?raw'
import star from '../../examples/star.py?raw'

// Import the source files directly so the menu and the files in examples/ stay identical.
export const examples = [
  { id: 'house', title: 'House', source: house },
  { id: 'star', title: 'Star', source: star },
  { id: 'flower', title: 'Flower', source: flower },
  { id: 'rainbow-spiral', title: 'Rainbow spiral', source: rainbowSpiral },
  { id: 'rocket-launch', title: 'Rocket launch (animated)', source: rocketLaunch },
] as const
export type Example = typeof examples[number]
