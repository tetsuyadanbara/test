let cellType;
if ((regions.ownTerritoryCount || 0) === 0) {
  if (regions.capitalAdjacent.length > 0) {
    cellType = 'capitalAdjacent';
  } else {
    cellType = 'mapEdge';
  }
} else if (currentProgress > 0 && currentProgress < 5) {
  if (regions.teamAdjacent.length > 0) {
    cellType = 'teamAdjacent';
  } else if (regions.nonAdjacent.length > 0) {
    cellType = 'nonAdjacent';
  } else if (regions.capitalAdjacent.length > 0) {
    cellType = 'capitalAdjacent';
  } else {
    cellType = 'mapEdge';
  }
} else {
  if (regions.teamAdjacent.length > 0) {
    cellType = 'teamAdjacent';
  } else if (regions.nonAdjacent.length > 0) {
    cellType = 'nonAdjacent';
  } else if (regions.capitalAdjacent.length > 0) {
    cellType = 'capitalAdjacent';
  } else {
    cellType = 'mapEdge';
  }
}
