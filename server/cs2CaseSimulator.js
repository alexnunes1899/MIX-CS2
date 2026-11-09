import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INVENTORY_FILE = path.join(__dirname, 'data', 'caseInventory.json');

export const CASE_DEFINITIONS = {
  kilowatt: {
    id: 'kilowatt',
    name: 'Caixa Quilowatt (Kilowatt Case)',
    icon: '⚡',
    knifeName: 'Faca Kukri',
    knifeImage: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpovbSsLQJf0ebcZThQ6tCvq4GGqPr1Ibndk1Rx5sB4nOrE84_3iVXtqBVuNW2nI9CdIQI_MVzU_1C-k-q808C4vsidwXJkvCJwsX-OmUeyhQYMUrNxxavJn3tC5j0/360fx360f',
    skins: {
      blue: [
        { name: 'Dual Berettas | Hideout', price: 1.20, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpos7asPwJf0Ob3dDxP6ce-mIGZk_TgDLbUkmJE5Yt13e3Eotz331fl80FoNzz2co_DIQE_Nl_W-1a9yL280JO-u5_OnnFj6HM8pSGKVB9N_c0/360fx360f' },
        { name: 'Nova | Dark Sigil', price: 0.90, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpouLWzQgZf0Ob3cjVq9jTmn4-0m_7zO6-fzj9V7cAl2eyT8d6j2gW2_0dpYGHxcoXBJgc8ZlGG81S6kOrqhMO1vZmdnSEx6XIm7H6LnhfmgAYMMLLW0H3YwA/360fx360f' },
        { name: 'SSG 08 | Dezastre', price: 2.10, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpopamie19f0Ob3Yi5FvISJmYGZnvnxDLbUkmJE5YtwjuqTo4_w3VLh-0A5a2n6cIWTJ1NsN13VrwDvx-rng5ftuprIyydluCQ8pSGKpS4rN-8/360fx360f' },
        { name: 'Tec-9 | Slag', price: 1.15, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpoor-mcjhzw8zFdC5K08-3moS0kfb4NoTdn2xZ_Ity3uvDpdmsigXtqBc-MmCmIdWRegc7aQzQq1K8kO7thJ-9vczLmnFq7yV243rdy0G10RhSLrs41DksJkI/360fx360f' },
      ],
      purple: [
        { name: 'Glock-18 | Block-18', price: 12.50, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgposbaqKAxf0Ob3djFN79eJkI-KhsjksD5V5_Z5ca133LyTrNz32Qfn-0NuYWjycIWTdgU4aF_Z_Ae2xOu6hZe-75_LmnNl73Rz5SuImha_hAYMMLI0l60t0A/360fx360f' },
        { name: 'Five-SeveN | Hybrid', price: 9.80, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgposLOzLhRlxf0h3vzxII-5mpS0kfb4NoTdn2xZ_Isg0r3H99Sl3wDjr0NoZm73LYOdcwU2Y17UrFfsxr_u1MXqu5idnXQ3uCRw53renEey0BhILrs475_E8d8/360fx360f' },
        { name: 'MAC-10 | Light Box', price: 8.40, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpou7umeldf0Ob3fDxBvdmJmY-Zkvb4DLbUkmJE5Ysm2riVpNyj21DkqENqNW_yJdOXdwU6aFiF_1Ltle_nh57puJrOzydguiMm4CzemhewhQYMMLI4bA68qQ/360fx360f' },
      ],
      pink: [
        { name: 'Zeus x27 | Olympus', price: 78.00, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpou7umeldf0Ob3fDxBvdmJmY-Zkvb4DLbUkmJE5Ysg3-3E9N2j0AG1_0ZsY2z7d4CRIQA6aFnYqFHtx7_o0MO16czJy3I26T5iuyi34Y2Kug/360fx360f' },
        { name: 'USP-S | Jawbreaker', price: 95.00, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpoo6m1FBRp3_bGcjhQ09-jq5WYh8j_OrfdqWhe5sN4mOTE84nw3lG3-kdsNzymdYOWcAZtYw3Q-lDskLrng5W87pnPzHQ37CEmsH-JnBfk1AYMMLJ1Y49k2g/360fx360f' },
        { name: 'M4A1-S | Black Lotus', price: 120.00, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpou-6kejhjxszFJTwW09izh5SEhcj5Nr_Yg2YfscFw3erD9t6s2wGwqhU5MmH2coORdFc2aV3Z81C4xOjugZe6uJvPyiBquCRw5HfanEbmgAYMMLL95B1m9Q/360fx360f' },
      ],
      red: [
        { name: 'AK-47 | Inheritance', price: 680.00, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpot7HxfDhjxszJemkV09-5lpKKqPrxN7LEmyVQ7MEpiLuSrYmnjQO3-UdsZ2GlI4PBdQc6aVvV-QO7wuvr0MW6upnKyHBh73V04HjfnUew1AYMMLI58a44dg/360fx360f' },
        { name: 'AWP | Chrome Cannon', price: 490.00, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpot621FABz7PLfYQJS5NO0m5O0m_7zO6-fk29T-sBwju-U99r30QLs8hA9MGildtXAcANsZ1nTrle2wL_vgZe07Zqfm3c36HIlsXnemhe1hAYMMLKEQY9r0g/360fx360f' },
      ],
      gold: [
        { name: '★ Faca Kukri | Fade', price: 4200.00, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpovbSsLQJf0ebcZThQ6tCvq4GGqPr1Ibndk1Rx5sB4nOrE84_3iVXtqBVuNW2nI9CdIQI_MVzU_1C-k-q808C4vsidwXJkvCJwsX-OmUeyhQYMUrNxxavJn3tC5j0/360fx360f' },
        { name: '★ Faca Kukri | Slaughter', price: 2900.00, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpovbSsLQJf0ebcZThQ6tCvq4GGqPr1Ibndk1Rx5sB4nOrE84_3iVXtqBVuNW2nI9CdIQI_MVzU_1C-k-q808C4vsidwXJkvCJwsX-OmUeyhQYMUrNxxavJn3tC5j0/360fx360f' },
        { name: '★ Faca Kukri | Vanilla', price: 2100.00, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpovbSsLQJf0ebcZThQ6tCvq4GGqPr1Ibndk1Rx5sB4nOrE84_3iVXtqBVuNW2nI9CdIQI_MVzU_1C-k-q808C4vsidwXJkvCJwsX-OmUeyhQYMUrNxxavJn3tC5j0/360fx360f' },
      ],
    },
  },
  dreams: {
    id: 'dreams',
    name: 'Caixa Sonhos e Pesadelos (Dreams & Nightmares)',
    icon: '🌙',
    knifeName: 'Faca Butterfly / Falchion',
    knifeImage: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpovbSsLQJf1fLEcjVL49KJlY20k_jkI7fUhGJP54t03-rA-onw31Xm-xVoZDr7d9SQdFU8ZV6B-VTsx-7vgp-07c_InCE3uiBz5CuJnxC00h5SLrs4yH_Jp-A/360fx360f',
    skins: {
      blue: [
        { name: 'Five-SeveN | Scrawl', price: 1.10, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgposLOzLhRlxf0h3vzxII-5mpS0kfb4NoTdn2xZ_Isg0r3H99Sl3wDjr0NoZm73LYOdcwU2Y17UrFfsxr_u1MXqu5idnXQ3uCRw53renEey0BhILrs475_E8d8/360fx360f' },
        { name: 'MAC-10 | Ensnared', price: 0.95, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpou7umeldf0Ob3fDxBvdmJmY-Zkvb4DLbUkmJE5Ysm2riVpNyj21DkqENqNW_yJdOXdwU6aFiF_1Ltle_nh57puJrOzydguiMm4CzemhewhQYMMLI4bA68qQ/360fx360f' },
        { name: 'MP9 | Starlight Protector', price: 18.00, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpou6ryFA957P3dcjtD_9myp420m_7zO6-fk29T-sBwju-U99r30QLs8hA9MGildtXAcANsZ1nTrle2wL_vgZe07Zqfm3c36HIlsXnemhe1hAYMMLKEQY9r0g/360fx360f' },
      ],
      purple: [
        { name: 'Dual Berettas | Melondrama', price: 14.00, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpos7asPwJf0Ob3dDxP6ce-mIGZk_TgDLbUkmJE5Yt13e3Eotz331fl80FoNzz2co_DIQE_Nl_W-1a9yL280JO-u5_OnnFj6HM8pSGKVB9N_c0/360fx360f' },
        { name: 'FAMAS | Rapid Eye Movement', price: 16.50, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpopamie19f0Ob3Yi5FvISJmYGZnvnxDLbUkmJE5YtwjuqTo4_w3VLh-0A5a2n6cIWTJ1NsN13VrwDvx-rng5ftuprIyydluCQ8pSGKpS4rN-8/360fx360f' },
      ],
      pink: [
        { name: 'USP-S | Ticket to Hell', price: 42.00, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpoo6m1FBRp3_bGcjhQ09-jq5WYh8j_OrfdqWhe5sN4mOTE84nw3lG3-kdsNzymdYOWcAZtYw3Q-lDskLrng5W87pnPzHQ37CEmsH-JnBfk1AYMMLJ1Y49k2g/360fx360f' },
      ],
      red: [
        { name: 'AK-47 | Nightwish', price: 450.00, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpot7HxfDhjxszJemkV09-5lpKKqPrxN7LEmyVQ7MEpiLuSrYmnjQO3-UdsZ2GlI4PBdQc6aVvV-QO7wuvr0MW6upnKyHBh73V04HjfnUew1AYMMLI58a44dg/360fx360f' },
      ],
      gold: [
        { name: '★ Faca Butterfly | Lore', price: 7800.00, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpovbSsLQJf1fLEcjVL49KJlY20k_jkI7fUhGJP54t03-rA-onw31Xm-xVoZDr7d9SQdFU8ZV6B-VTsx-7vgp-07c_InCE3uiBz5CuJnxC00h5SLrs4yH_Jp-A/360fx360f' },
        { name: '★ Faca Falchion | Gamma Doppler', price: 1950.00, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpovbSsLQJf1fLEcjVL49KJlY20k_jkI7fUhGJP54t03-rA-onw31Xm-xVoZDr7d9SQdFU8ZV6B-VTsx-7vgp-07c_InCE3uiBz5CuJnxC00h5SLrs4yH_Jp-A/360fx360f' },
      ],
    },
  },
  recoil: {
    id: 'recoil',
    name: 'Caixa Coice (Recoil Case)',
    icon: '💥',
    knifeName: 'Luvas Especiais',
    knifeImage: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpovbSsLQJfxPrMfipP7dezhr-YmMjkJ7fUhGJP54t03-rA-onw31Xm-xVoZDr7d9SQdFU8ZV6B-VTsx-7vgp-07c_InCE3uiBz5CuJnxC00h5SLrs4yH_Jp-A/360fx360f',
    skins: {
      blue: [
        { name: 'Galil AR | Destroyer', price: 1.05, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgposbupIgth18zAcDlH_9m_nYS0hPbkI7fUglRc7cF4n-SPp9yn2wO28xFvMm_6LIaWJwA_NFvWrla2w7rvg5PuusidySc2pGB8slLhL6p5/360fx360f' },
      ],
      purple: [
        { name: 'M4A4 | Poly Mag', price: 6.20, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpou-6kejhjxszFJTwW09izh5SEhcj5Nr_Yg2YfscFw3erD9t6s2wGwqhU5MmH2coORdFc2aV3Z81C4xOjugZe6uJvPyiBquCRw5HfanEbmgAYMMLL95B1m9Q/360fx360f' },
      ],
      pink: [
        { name: 'AK-47 | Ice Coaled', price: 92.00, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpot7HxfDhjxszJemkV09-5lpKKqPrxN7LEmyVQ7MEpiLuSrYmnjQO3-UdsZ2GlI4PBdQc6aVvV-QO7wuvr0MW6upnKyHBh73V04HjfnUew1AYMMLI58a44dg/360fx360f' },
      ],
      red: [
        { name: 'USP-S | Printstream', price: 540.00, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpoo6m1FBRp3_bGcjhQ09-jq5WYh8j_OrfdqWhe5sN4mOTE84nw3lG3-kdsNzymdYOWcAZtYw3Q-lDskLrng5W87pnPzHQ37CEmsH-JnBfk1AYMMLJ1Y49k2g/360fx360f' },
        { name: 'AWP | Chromatic Aberration', price: 320.00, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpot621FABz7PLfYQJS5NO0m5O0m_7zO6-fk29T-sBwju-U99r30QLs8hA9MGildtXAcANsZ1nTrle2wL_vgZe07Zqfm3c36HIlsXnemhe1hAYMMLKEQY9r0g/360fx360f' },
      ],
      gold: [
        { name: '★ Luvas Moto | Finish Line', price: 3400.00, img: 'https://community.cloudflare.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpovbSsLQJfxPrMfipP7dezhr-YmMjkJ7fUhGJP54t03-rA-onw31Xm-xVoZDr7d9SQdFU8ZV6B-VTsx-7vgp-07c_InCE3uiBz5CuJnxC00h5SLrs4yH_Jp-A/360fx360f' },
      ],
    },
  },
};

export class CS2CaseSimulator {
  constructor() {
    this.inventories = new Map();
    this.loadInventories();
  }

  loadInventories() {
    try {
      if (fs.existsSync(INVENTORY_FILE)) {
        const raw = fs.readFileSync(INVENTORY_FILE, 'utf-8');
        const data = JSON.parse(raw);
        for (const [userId, inv] of Object.entries(data)) {
          this.inventories.set(userId, inv);
        }
      }
    } catch (e) {}
  }

  saveInventories() {
    try {
      const dir = path.dirname(INVENTORY_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const obj = {};
      for (const [userId, inv] of this.inventories.entries()) {
        obj[userId] = inv;
      }
      fs.writeFileSync(INVENTORY_FILE, JSON.stringify(obj, null, 2));
    } catch (e) {}
  }

  getUserInventory(userId, username = 'Gamer') {
    if (!this.inventories.has(userId)) {
      this.inventories.set(userId, {
        userId,
        username,
        casesOpened: 0,
        totalSpent: 0, // In R$ (R$ 14,00 per key)
        totalValue: 0,
        knivesUnboxed: 0,
        bestDrop: null,
        recentDrops: [],
      });
    }
    const inv = this.inventories.get(userId);
    if (username) inv.username = username;
    return inv;
  }

  /**
   * Simulates opening a case with realistic Valve odds
   */
  openCase(caseId = 'kilowatt', user = { id: 'anonymous', username: 'Gamer' }) {
    const selectedCase = CASE_DEFINITIONS[caseId] || CASE_DEFINITIONS.kilowatt;

    // Valve Odds:
    // Blue: 79.92%, Purple: 15.98%, Pink: 3.20%, Red: 0.64%, Gold: 0.26%
    const rand = Math.random() * 100;
    let tier = 'blue';
    let tierLabel = 'Grau Militar (Azul)';
    let colorHex = 0x4b69ff;

    if (rand < 0.26) {
      tier = 'gold';
      tierLabel = '★ Item Especial Raro (Dourado)';
      colorHex = 0xffd700;
    } else if (rand < 0.26 + 0.64) {
      tier = 'red';
      tierLabel = 'Secreto (Vermelho)';
      colorHex = 0xeb4b4b;
    } else if (rand < 0.26 + 0.64 + 3.20) {
      tier = 'pink';
      tierLabel = 'Confidencial (Rosa)';
      colorHex = 0xd32ce6;
    } else if (rand < 0.26 + 0.64 + 3.20 + 15.98) {
      tier = 'purple';
      tierLabel = 'Restrito (Roxo)';
      colorHex = 0x8847ff;
    }

    const skinList = selectedCase.skins[tier] || selectedCase.skins.blue;
    const baseSkin = skinList[Math.floor(Math.random() * skinList.length)];

    // Float & Wear
    const floatVal = Math.random();
    let wear = 'Testada em Campo (FT)';
    let wearMultiplier = 1.0;

    if (floatVal < 0.07) {
      wear = 'Nova de Fábrica (FN)';
      wearMultiplier = 1.7;
    } else if (floatVal < 0.15) {
      wear = 'Pouco Usada (MW)';
      wearMultiplier = 1.3;
    } else if (floatVal < 0.38) {
      wear = 'Testada em Campo (FT)';
      wearMultiplier = 1.0;
    } else if (floatVal < 0.45) {
      wear = 'Bem Desgastada (WW)';
      wearMultiplier = 0.85;
    } else {
      wear = 'Veterana de Guerra (BS)';
      wearMultiplier = 0.7;
    }

    // StatTrak (10% chance)
    const isStatTrak = Math.random() < 0.10;
    const statTrakMultiplier = isStatTrak ? 1.8 : 1.0;

    const finalPrice = Math.round(baseSkin.price * wearMultiplier * statTrakMultiplier * 100) / 100;
    const skinNameWithStatTrak = isStatTrak ? `StatTrak™ ${baseSkin.name}` : baseSkin.name;

    // Update user inventory
    const inv = this.getUserInventory(user.id, user.username);
    inv.casesOpened += 1;
    inv.totalSpent += 14.00; // Standard Steam key price (approx R$ 14)
    inv.totalValue = Math.round((inv.totalValue + finalPrice) * 100) / 100;

    if (tier === 'gold') {
      inv.knivesUnboxed += 1;
    }

    if (!inv.bestDrop || finalPrice > inv.bestDrop.price) {
      inv.bestDrop = {
        name: skinNameWithStatTrak,
        price: finalPrice,
        tier,
        date: new Date().toLocaleDateString('pt-BR'),
      };
    }

    inv.recentDrops.unshift({
      name: skinNameWithStatTrak,
      price: finalPrice,
      tier,
      wear,
    });
    if (inv.recentDrops.length > 5) inv.recentDrops.pop();

    this.saveInventories();

    return {
      caseName: selectedCase.name,
      caseId: selectedCase.id,
      tier,
      tierLabel,
      colorHex,
      skinName: skinNameWithStatTrak,
      isStatTrak,
      wear,
      floatVal: floatVal.toFixed(4),
      price: finalPrice,
      img: baseSkin.img,
      user,
      inv,
    };
  }

  buildEmbed(drop) {
    const profit = Math.round((drop.price - 14.00) * 100) / 100;
    const profitText =
      profit >= 0
        ? `🟢 **LUCRO:** \`+R$ ${profit.toFixed(2).replace('.', ',')}\``
        : `🔴 **PREJUÍZO:** \`-R$ ${Math.abs(profit).toFixed(2).replace('.', ',')}\``;

    const embed = new EmbedBuilder()
      .setTitle(`🎰 CS2 UNBOXING — ${drop.skinName.toUpperCase()}`)
      .setColor(drop.colorHex)
      .setThumbnail(drop.img)
      .setDescription(
        `Parabéns <@${drop.user.id}>! Você abriu uma **${drop.caseName}**!\n\n` +
        `**Raridade:** \`${drop.tierLabel}\`\n` +
        `**Desgaste:** \`${drop.wear}\` (Float: \`${drop.floatVal}\`)\n` +
        (drop.isStatTrak ? `🟠 **STATTRAK™ ATIVADO!**\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💰 **Valor de Mercado:** \`R$ ${drop.price.toFixed(2).replace('.', ',')}\`\n` +
        `${profitText}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      )
      .addFields(
        {
          name: '📦 Caixas Abertas',
          value: `\`${drop.inv.casesOpened}\` caixas`,
          inline: true,
        },
        {
          name: '💎 Facas / Ouro',
          value: `\`${drop.inv.knivesUnboxed}\` facas`,
          inline: true,
        },
        {
          name: '🏆 Melhor Drop',
          value: drop.inv.bestDrop
            ? `**${drop.inv.bestDrop.name}**\n(R$ ${drop.inv.bestDrop.price.toFixed(2).replace('.', ',')})`
            : '*Nenhum*',
          inline: true,
        }
      )
      .setFooter({
        text: 'Probabilidades Oficiais Valve: Azul 80% • Roxo 16% • Rosa 3.2% • Vermelho 0.64% • Ouro 0.26%',
        iconURL: 'https://cdn.cloudflare.steamstatic.com/apps/csgo/images/csgo_react/global/logo_cs_long.svg',
      })
      .setTimestamp();

    if (drop.tier === 'gold') {
      embed.setImage(drop.img);
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`case_open_${drop.caseId}`)
        .setLabel('Abrir Outra Caixa')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🎰'),
      new ButtonBuilder()
        .setCustomId('case_inventory')
        .setLabel('Meu Inventário')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎒')
    );

    return { embeds: [embed], components: [row] };
  }

  buildInventoryEmbed(user) {
    const inv = this.getUserInventory(user.id, user.username);
    const balance = Math.round((inv.totalValue - inv.totalSpent) * 100) / 100;
    const balanceText =
      balance >= 0
        ? `🟢 Lucro Total: \`+R$ ${balance.toFixed(2).replace('.', ',')}\``
        : `🔴 Prejuízo Total: \`-R$ ${Math.abs(balance).toFixed(2).replace('.', ',')}\``;

    const embed = new EmbedBuilder()
      .setTitle(`🎒 INVENTÁRIO DE CAIXAS — ${user.username.toUpperCase()}`)
      .setColor(0x3b82f6)
      .setDescription(
        `Estatísticas de abertura de caixas de Counter-Strike 2 no Discord:\n\n` +
        `📦 **Total de Caixas Abertas:** \`${inv.casesOpened}\`\n` +
        `💸 **Total Investido (Chaves):** \`R$ ${inv.totalSpent.toFixed(2).replace('.', ',')}\`\n` +
        `💰 **Valor Total Desbloqueado:** \`R$ ${inv.totalValue.toFixed(2).replace('.', ',')}\`\n` +
        `${balanceText}\n` +
        `🔪 **Facas & Especiais Ouro:** \`${inv.knivesUnboxed}\`\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      )
      .addFields(
        {
          name: '🏆 Melhor Drop Histórico',
          value: inv.bestDrop
            ? `**${inv.bestDrop.name}**\nValor: \`R$ ${inv.bestDrop.price.toFixed(2).replace('.', ',')}\` em ${inv.bestDrop.date}`
            : '*Nenhum drop registrado ainda*',
          inline: false,
        },
        {
          name: '🕒 Últimos Drops Recentes',
          value:
            inv.recentDrops.length > 0
              ? inv.recentDrops
                  .map((d) => `• **${d.name}** (${d.wear}) — \`R$ ${d.price.toFixed(2).replace('.', ',')}\``)
                  .join('\n')
              : '*Abra uma caixa com `!caixa` ou `/caixa`!*',
          inline: false,
        }
      )
      .setFooter({
        text: 'CS2 Case Simulator • Use !caixa para girar outra',
        iconURL: 'https://cdn.cloudflare.steamstatic.com/apps/csgo/images/csgo_react/global/logo_cs_long.svg',
      });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('case_open_kilowatt')
        .setLabel('Abrir Caixa Quilowatt')
        .setStyle(ButtonStyle.Success)
        .setEmoji('⚡'),
      new ButtonBuilder()
        .setCustomId('case_open_dreams')
        .setLabel('Abrir Sonhos & Pesadelos')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🌙')
    );

    return { embeds: [embed], components: [row] };
  }
}

export const cs2CaseSimulator = new CS2CaseSimulator();
