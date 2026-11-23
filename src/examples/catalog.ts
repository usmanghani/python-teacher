import flower from '../../examples/flower.py?raw'
import house from '../../examples/house.py?raw'
import rainbowSpiral from '../../examples/rainbow-spiral.py?raw'
import rocketLaunch from '../../examples/rocket-launch.py?raw'
import star from '../../examples/star.py?raw'
import audi from '../../examples/logos/audi.py?raw'
import delta from '../../examples/logos/delta.py?raw'
import mastercard from '../../examples/logos/mastercard.py?raw'
import microsoft from '../../examples/logos/microsoft.py?raw'
import mitsubishi from '../../examples/logos/mitsubishi.py?raw'
import olympicRings from '../../examples/logos/olympic-rings.py?raw'
import swiss from '../../examples/logos/swiss.py?raw'
import target from '../../examples/logos/target.py?raw'
import visa from '../../examples/logos/visa.py?raw'

// Import the source files directly so the menu and the files in examples/ stay identical.
export const examples = [
  { id: 'house', group: 'Pictures', title: 'House', source: house },
  { id: 'star', group: 'Pictures', title: 'Star', source: star },
  { id: 'flower', group: 'Pictures', title: 'Flower', source: flower },
  { id: 'rainbow-spiral', group: 'Pictures', title: 'Rainbow spiral', source: rainbowSpiral },
  { id: 'rocket-launch', group: 'Pictures', title: 'Rocket launch (animated)', source: rocketLaunch },
  { id: 'logo-mastercard', group: 'Famous logos: cards', title: 'Mastercard', source: mastercard },
  { id: 'logo-visa', group: 'Famous logos: cards', title: 'Visa', source: visa },
  { id: 'logo-delta', group: 'Famous logos: airlines', title: 'Delta Air Lines', source: delta },
  { id: 'logo-swiss', group: 'Famous logos: airlines', title: 'Swiss', source: swiss },
  { id: 'logo-olympic-rings', group: 'Famous logos: more', title: 'Olympic rings', source: olympicRings },
  { id: 'logo-audi', group: 'Famous logos: more', title: 'Audi', source: audi },
  { id: 'logo-mitsubishi', group: 'Famous logos: more', title: 'Mitsubishi', source: mitsubishi },
  { id: 'logo-target', group: 'Famous logos: more', title: 'Target', source: target },
  { id: 'logo-microsoft', group: 'Famous logos: more', title: 'Microsoft', source: microsoft },
] as const
export type Example = typeof examples[number]
export const exampleGroups = [...new Set(examples.map(example => example.group))]
