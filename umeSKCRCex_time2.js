if (isLateCounter) {
            await drawProgressBar();

            if (shouldStopLateCounterMonitor(currentProgress)) {
              nextProgress = (currentProgress < 98) ? 52 : 2;
              autoJoinMode = stdCounterActive ? 'stdP' : (isMorningTime() ? 'umeR' : 'stdP');
              stdCounterActive = false;
              counterMonitorLogged = false;
              suppressCounterNoTargetLog = false;
              lateCounterStartLogged = false;
              isAutoJoinRunning = false;
              logMessage(null, '[監視停止] ' + currentProgress + '%でLate counter終了', `→ ${nextProgress}±1% / next:${autoJoinMode}`);
              return;
            }

            const lateMonitorMs = getLateCounterMonitorMs(currentProgress);
            const skippedCount = Number(regions.__counterExcludedCount || 0);
            const lateEnemyCount = Number(regions.__lateCounterEnemyCount || 0);

            if (!lateCounterStartLogged) {
              logMessage(null, '[移行] Late counter開始', `→ ${currentProgress}%`);
              lateCounterStartLogged = true;
            }

            const shouldShowExcludedLog = skippedCount > 0;
            const shouldShowNormalLog = !counterMonitorLogged;

            if (shouldShowExcludedLog || shouldShowNormalLog) {
              if (skippedCount > 0) {
                logMessage(null, `[監視] counter除外でスキップ (${skippedCount}件)`, `→ ${lateMonitorMs / 1000}s`);
              } else if (lateEnemyCount < 2) {
                logMessage(null, '[監視] Late counter待機（敵2マス未満）', `→ ${lateMonitorMs / 1000}s`);
              } else {
                logMessage(null, '[監視] Late counter待機（首都以外のみ攻撃）', `→ ${lateMonitorMs / 1000}s`);
              }
            }

            if (suppressCounterNoTargetLog) {
              suppressCounterNoTargetLog = false;
            }
            counterMonitorLogged = true;

            await sleep(lateMonitorMs);

            excludeSet.clear();
            regions = await getRegions();
            cellType = pickCellType(regions, cellType) || 'mapEdge';
            continue;
          }
