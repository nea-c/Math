execute if predicate math:.validation/.common/interpolation/time_at_or_below_start run return run data modify storage math: ans set from storage math: a
execute if predicate math:.validation/.common/interpolation/time_at_or_after_end run return run data modify storage math: ans set from storage math: b
execute if predicate {type:"float_value_check",value:{type:"storage",path:"amplitude",storage:"math:"},test:1} run return run function math:elastic/3.unit_amplitude
data modify storage math: internal.x set compute default float {"type":"div","left":1,"right":{"type":"storage","storage":"math:","path":"amplitude"}}
function math:.common/asin_positive/0.start
function math:elastic/2.phase
