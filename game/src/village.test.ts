import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decodeVillage,GUIDE,SPAWN,pathTo,placeable,screenPoint,walkable} from './village.ts';
test('plaza navigation blocks pond, roofs and NPC footprint',()=>{
  assert.ok(walkable(SPAWN));assert.ok(!walkable({x:1050,y:240}));
  assert.ok(!walkable({x:150,y:200}));assert.ok(!walkable(GUIDE));
});
test('route stays in navigation area and cannot cross a placed object',()=>{
  const placed=[{x:610,y:410,kind:'flower' as const}];
  const path=pathTo(SPAWN,{x:610,y:350},placed);
  assert.ok(path.length>0);for(const p of path)assert.ok(walkable(p,placed));
  assert.deepEqual(pathTo(SPAWN,{x:1050,y:240},placed),[]);
});
test('canvas click coordinates use logical pixels independent of backing scale',()=>{
  assert.deepEqual(screenPoint(330,200,{left:10,top:20,width:640,height:360}),{x:640,y:360});
});
test('save validation rejects corrupted, duplicate and invalid placements',()=>{
  assert.deepEqual(decodeVillage('{'),decodeVillage(null));
  const save=decodeVillage(JSON.stringify({version:1,player:SPAWN,quest:3,placed:[{x:500,y:420,kind:'flower'},{x:500,y:420,kind:'flower'},{x:1050,y:240,kind:'lantern'}]}));
  assert.equal(save.placed.length,1);assert.equal(save.quest,3);
  assert.ok(!placeable(SPAWN,[],SPAWN));
});
