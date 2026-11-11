import {
  ArrowRight,
  Footprints,
  Hammer,
  PackageCheck,
  PackagePlus,
  Users,
} from "lucide-react";
import { ResourceArt } from "./Art";
import {
  inventoryCount,
  capacity,
  RESOURCES,
  resourceNames,
  stockCapacity,
  stockCount,
  WORKERS,
} from "./game/model";
import type {
  ActivityId,
  GameState,
  Resource,
  UpgradeId,
  WorkerRole,
} from "./game/model";

export const WORKPLACES: {
  id: ActivityId;
  name: string;
  description: string;
  resource: Resource;
  upgrade?: UpgradeId;
}[] = [
  {
    id: "wood",
    name: "Pines",
    description: "Fell trees and collect timber.",
    resource: "wood",
  },
  {
    id: "fish",
    name: "Fishing dock",
    description: "Cast a line and land whole tuna.",
    resource: "fish",
  },
  {
    id: "steaks",
    name: "Cutting table",
    description: "Slice whole tuna into fresh steaks.",
    resource: "steak",
  },
  {
    id: "crab",
    name: "Crab pots",
    description: "Haul up pots and collect live crabs.",
    resource: "crab",
  },
  {
    id: "kelp",
    name: "Kelp beds",
    description: "Harvest seaweed along the north shore.",
    resource: "kelp",
  },
  {
    id: "ore",
    name: "Quarry",
    description: "Break rock with a pickaxe and collect ore.",
    resource: "ore",
  },
  {
    id: "planks",
    name: "Sawmill",
    description: "Saw timber into valuable planks.",
    resource: "plank",
    upgrade: "sawmill",
  },
  {
    id: "smoked",
    name: "Smokehouse",
    description: "Use timber to smoke fresh steaks.",
    resource: "smoked",
    upgrade: "smokehouse",
  },
  {
    id: "ingots",
    name: "Forge",
    description: "Smelt ore and hammer out metal ingots.",
    resource: "ingot",
    upgrade: "forge",
  },
  {
    id: "meals",
    name: "Kitchen",
    description: "Cook seafood and kelp into hot meals.",
    resource: "meal",
    upgrade: "kitchen",
  },
  {
    id: "tackle",
    name: "Boatyard",
    description: "Make tackle kits from planks and metal.",
    resource: "tackle",
    upgrade: "boatyard",
  },
  {
    id: "warehouse",
    name: "Warehouse",
    description: "Collect deliveries or drop off supplies.",
    resource: "plank",
  },
  {
    id: "market",
    name: "Market",
    description: "Serve customers and collect payment.",
    resource: "steak",
  },
];
export function WorkplacesPanel({
  game,
  onGo,
  onBuild,
  onWarehouse,
}: {
  game: GameState;
  onGo: (id: ActivityId) => void;
  onBuild: (id: UpgradeId) => void;
  onWarehouse: () => void;
}) {
  return (
    <div className="sheet-scroll workplaces-content">
      <p className="panel-explanation">
        Choose a workplace. Your captain walks there through the harbor.
      </p>
      <div className="workplace-list">
        {WORKPLACES.map((place) => {
          const locked = place.upgrade && game.upgrades[place.upgrade] < 1;
          return (
            <button
              className="workplace-card"
              data-workplace={place.id}
              key={place.id}
              aria-label={`${locked ? "Build" : "Go"} ${place.name}`}
              onClick={() =>
                place.id === "warehouse"
                  ? onWarehouse()
                  : locked
                    ? onBuild(place.upgrade!)
                    : onGo(place.id)
              }
            >
              <span className="workplace-art">
                <ResourceArt type={place.resource} size={43} />
              </span>
              <span>
                <strong>{place.name}</strong>
                <small>{place.description}</small>
              </span>
              <i>{locked ? <Hammer size={23} /> : <Footprints size={23} />}</i>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WarehousePanel({
  game,
  onTransfer,
}: {
  game: GameState;
  onTransfer: (direction: "collect" | "deposit") => void;
}) {
  const count = stockCount(game),
    limit = stockCapacity(game),
    pack = inventoryCount(game);
  return (
    <>
      <div className="warehouse-heading">
        <PackageCheck size={34} />
        <div>
          <strong>
            {count}
            <small> / {limit}</small>
          </strong>
          <span>GOODS IN STORAGE</span>
        </div>
      </div>
      <div className="sheet-scroll warehouse-content">
        <p className="panel-explanation">
          Dockhands deliver real goods here. Leave tuna for your cutter and
          steaks and kelp for your cook.
        </p>
        <div className="warehouse-grid">
          {RESOURCES.map((resource) => (
            <div
              className={`warehouse-item ${game.stock[resource] ? "has-stock" : ""}`}
              data-stock-resource={resource}
              key={resource}
            >
              <ResourceArt type={resource} size={39} />
              <span>{resourceNames[resource]}</span>
              <strong>{game.stock[resource]}</strong>
            </div>
          ))}
        </div>
        <div className="warehouse-flow">
          <PackagePlus size={26} />
          <p>
            Reserved ingredients stay with the worker until the job is finished.
            Full storage pauses deliveries.
          </p>
        </div>
      </div>
      <footer className="warehouse-footer">
        <button
          className="large-game-button blue"
          aria-label="Deposit supplies"
          disabled={pack < 1}
          onClick={() => onTransfer("deposit")}
        >
          <PackagePlus size={24} />
          <span>
            DROP CARGO<small>{pack} carried goods</small>
          </span>
        </button>
        <button
          className="large-game-button green"
          aria-label="Collect goods"
          disabled={!count || pack >= capacity(game)}
          onClick={() => onTransfer("collect")}
        >
          <PackageCheck size={24} />
          <span>
            COLLECT GOODS
            <small>{capacity(game) - pack} spaces in your pack</small>
          </span>
        </button>
      </footer>
    </>
  );
}

const workerRequirement: Partial<
  Record<WorkerRole, { id: UpgradeId; name: string }>
> = {
  cutter: { id: "cutter", name: "powered cutter" },
  miner: { id: "quarry", name: "quarry" },
  gardener: { id: "kelpfarm", name: "kelp farm" },
  crabber: { id: "crabpots", name: "crab pots" },
  cook: { id: "kitchen", name: "kitchen" },
};
export function CrewOverview({
  game,
  onBuild,
  onWarehouse,
}: {
  game: GameState;
  onBuild: (id: UpgradeId) => void;
  onWarehouse: () => void;
}) {
  return (
    <section className="crew-overview">
      <p className="panel-explanation">
        Your apprentice starts on the dock. More hires add specialist workers,
        not just a cash bonus.
      </p>
      <div className="crew-roles">
        {WORKERS.map((worker) => {
          const hired = game.upgrades.crew >= worker.requiredCrew,
            requirement = workerRequirement[worker.id],
            needsBuilding =
              hired && requirement && game.upgrades[requirement.id] < 1,
            job = game.workerJobs[worker.id];
          const status = !hired
            ? `Crew tier ${worker.requiredCrew}`
            : needsBuilding
              ? `Needs ${requirement.name}`
              : job
                ? "Working / delivering"
                : worker.id === "porter"
                  ? "Serving stored goods"
                  : "On duty";
          return (
            <div
              className={`crew-role ${hired ? "hired" : ""}`}
              data-worker-role={worker.id}
              key={worker.id}
            >
              <span>
                <Users size={22} />
              </span>
              <div>
                <strong>{worker.name}</strong>
                <small>{status}</small>
              </div>
              {needsBuilding && (
                <button
                  className="crew-build"
                  aria-label={`Build ${requirement.name}`}
                  onClick={() => onBuild(requirement.id)}
                >
                  <Hammer size={20} />
                </button>
              )}
              {hired && !needsBuilding && <i className="worker-live-dot" />}
            </div>
          );
        })}
      </div>
      <button className="crew-storage-link" onClick={onWarehouse}>
        <PackageCheck size={24} />
        <span>{stockCount(game)} goods delivered to storage</span>
        <ArrowRight size={21} />
      </button>
    </section>
  );
}
