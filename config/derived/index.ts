import { mergeDerivations } from "../../scripts/lib/derived-config.js";
import { derivations as accessibility } from "./accessibility.js";
import { derivations as account } from "./account.js";
import { derivations as animals } from "./animals.js";
import { derivations as arrows } from "./arrows.js";
import { derivations as buildings } from "./buildings.js";
import { derivations as charts } from "./charts.js";
import { derivations as communication } from "./communication.js";
import { derivations as connectivity } from "./connectivity.js";
import { derivations as cursors } from "./cursors.js";
import { derivations as design } from "./design.js";
import { derivations as development } from "./development.js";
import { derivations as devices } from "./devices.js";
import { derivations as emoji } from "./emoji.js";
import { derivations as files } from "./files.js";
import { derivations as finance } from "./finance.js";
import { derivations as foodBeverage } from "./food-beverage.js";
import { derivations as gaming } from "./gaming.js";
import { derivations as home } from "./home.js";
import { derivations as layout } from "./layout.js";
import { derivations as mail } from "./mail.js";
import { derivations as math } from "./math.js";
import { derivations as medical } from "./medical.js";
import { derivations as multimedia } from "./multimedia.js";
import { derivations as nature } from "./nature.js";
import { derivations as navigation } from "./navigation.js";
import { derivations as notifications } from "./notifications.js";
import { derivations as photography } from "./photography.js";
import { derivations as science } from "./science.js";
import { derivations as security } from "./security.js";
import { derivations as shapes } from "./shapes.js";
import { derivations as shopping } from "./shopping.js";
import { derivations as social } from "./social.js";
import { derivations as sports } from "./sports.js";
import { derivations as sustainability } from "./sustainability.js";
import { derivations as text } from "./text.js";
import { derivations as time } from "./time.js";
import { derivations as tools } from "./tools.js";
import { derivations as transportation } from "./transportation.js";
import { derivations as travel } from "./travel.js";
import { derivations as weather } from "./weather.js";

/**
 * Every category's derivations, merged. Each category lives in its own file so it can be reviewed
 * and corrected independently; a name listed by two categories is an error.
 */
export const derived = mergeDerivations({
  accessibility: accessibility,
  account: account,
  animals: animals,
  arrows: arrows,
  buildings: buildings,
  charts: charts,
  communication: communication,
  connectivity: connectivity,
  cursors: cursors,
  design: design,
  development: development,
  devices: devices,
  emoji: emoji,
  files: files,
  finance: finance,
  "food-beverage": foodBeverage,
  gaming: gaming,
  home: home,
  layout: layout,
  mail: mail,
  math: math,
  medical: medical,
  multimedia: multimedia,
  nature: nature,
  navigation: navigation,
  notifications: notifications,
  photography: photography,
  science: science,
  security: security,
  shapes: shapes,
  shopping: shopping,
  social: social,
  sports: sports,
  sustainability: sustainability,
  text: text,
  time: time,
  tools: tools,
  transportation: transportation,
  travel: travel,
  weather: weather,
});
