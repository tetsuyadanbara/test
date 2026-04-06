const isUme = autoJoinMode === 'umeR';
        const isCounter = autoJoinMode === 'counter';
        const isLateCounter = autoJoinMode === 'lateCounter';
        const isCounterLike = isCounter || isLateCounter;
        const teamColorUpper = String(teamColor || '').toUpperCase();
        let nonAdjacentCells;
        let regions;

        if (isUme) {
          const nonAdjacentCells = cells.filter(([r, c]) => {
            const key = `${r}-${c}`;
            return !capitalSet.has(key) && !adjacentSet.has(key);
          });

          const onceMoreCells = nonAdjacentCells.filter(([r, c]) => {
            const key = `${r}-${c}`;
            return key in cellColors && !teamColorSet.has(key);
          });

          regions = {
            nonAdjacent: shuffle(filteredCells(nonAdjacentCells)),
            capitalAdjacent: shuffle(filteredCells(capitalAdjacentCells)),
            teamAdjacent: shuffle(filteredCells(teamAdjacentCells)),
            mapEdge: shuffle(filteredCells(mapEdgeCells)),
            onceMore: shuffle(filteredCells(onceMoreCells))
          };

          regions.__counterExcludedCount = 0;
          regions.__lateCounterEnemyCount = 0;
        } else {
          const nonAdjacentBase = cells.filter(([r, c]) => {
            const key = `${r}-${c}`;
            return !capitalSet.has(key) && !adjacentSet.has(key);
          });

          const onceMoreCells = nonAdjacentBase.filter(([r, c]) => {
            const key = `${r}-${c}`;
            return key in cellColors && !teamColorSet.has(key);
          });

          const excludedColors = [
            '00008B',//まほろば
            'FFFF00',//ライーヨー
            'FF0101',//赤い彗星
          ];

          const counterExcludedColors = isCounterLike
            ? new Set([
                ...excludedColors.map(v => String(v).toUpperCase()),
                ...[...getCounterExcludedColorSet()].map(v => String(v).toUpperCase())
              ])
            : new Set();

          let counterExcludedSkipped = 0;

          const isCounterExcludedColor = (color) => {
            if (!isCounterLike) return false;
            const normalized = String(color || '').replace(/^#/, '').toUpperCase();
            const shouldSkip = counterExcludedColors.has(normalized);
            if (shouldSkip) counterExcludedSkipped += 1;
            return shouldSkip;
          };

          const lateCounterEnemyCount = isLateCounter
            ? cells.filter(([r, c]) => {
                const key = `${r}-${c}`;
                const color = cellColors[key]?.replace('#', '').toUpperCase();
                return !!color && color !== teamColorUpper;
              }).length
            : 0;

          // 1. どこのチームにも属してないマス
          const group1 = shuffle(nonAdjacentBase.filter(([r, c]) => {
            const key = `${r}-${c}`;
            return !cellColors[key];
          }));

          // 2. 敵チームの首都および首都の上下左右ではないマス
          const group2 = shuffle(nonAdjacentBase.filter(([r, c]) => {
            const key = `${r}-${c}`;
            if (!cellColors[key]) return false;
            const color = cellColors[key].replace('#', '').toUpperCase();
            return color !== teamColorUpper && !isCounterExcludedColor(color);
          }));

          // 3. 敵チームの首都の上下左右のマス
          const group3 = shuffle(cells.filter(([r, c]) => {
            const key = `${r}-${c}`;
            if (capitalSet.has(key)) return false;
            if (!adjacentSet.has(key)) return false;

            if (!cellColors[key]) return true;
            const color = cellColors[key].replace('#', '').toUpperCase();
            return color !== teamColorUpper && !isCounterExcludedColor(color);
          }));

          // 4. 敵チームの首都
          const group4 = shuffle(cells.filter(([r, c]) => {
            const key = `${r}-${c}`;
            if (!capitalSet.has(key)) return false;
            if (!cellColors[key]) return false;
            const color = cellColors[key].replace('#', '').toUpperCase();
            return color !== teamColorUpper && !isCounterExcludedColor(color);
          }));

          // 1~4を結合
          if (isCounter) {
            const g2 = await priorityGuardCells(group2, true);
            const g3 = await priorityGuardCells(group3, true);
            const g4 = await priorityGuardCells(group4, true);
            nonAdjacentCells = [...g2, ...g3, ...g4];

            regions = {
              nonAdjacent: nonAdjacentCells,
              capitalAdjacent: [],
              teamAdjacent: [],
              mapEdge: [],
              onceMore: []
            };
          } else if (isLateCounter) {
            const lateGroup2 = lateCounterEnemyCount >= 2 ? group2 : [];
            const lateGroup3 = lateCounterEnemyCount >= 2 ? group3 : [];

            const g2 = await priorityGuardCells(lateGroup2, true);
            const g3 = await priorityGuardCells(lateGroup3, true);
            nonAdjacentCells = [...g2, ...g3];

            regions = {
              nonAdjacent: nonAdjacentCells,
              capitalAdjacent: [],
              teamAdjacent: [],
              mapEdge: [],
              onceMore: []
            };
          } else {
            const g1 = await priorityGuardCells(group1);
            const g2 = await priorityGuardCells(group2);
            const g3 = await priorityGuardCells(group3);
            const g4 = await priorityGuardCells(group4);
            nonAdjacentCells = [...g1, ...g2, ...g3, ...g4];

            regions = {
//            nonAdjacent: shuffle(nonAdjacentCells),
              nonAdjacent: nonAdjacentCells,
              capitalAdjacent: shuffle(capitalAdjacentCells),
              teamAdjacent: shuffle(teamAdjacentCells),
              mapEdge: shuffle(mapEdgeCells),
              onceMore: shuffle(filteredCells(onceMoreCells))
            };
          }

          regions.__counterExcludedCount = isCounterLike ? counterExcludedSkipped : 0;
          regions.__lateCounterEnemyCount = isLateCounter ? lateCounterEnemyCount : 0;
        }
