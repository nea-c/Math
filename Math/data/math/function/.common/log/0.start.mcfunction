function math:.common/log/1.prepare
data modify storage math: internal.z set compute default float {"type":"minecraft:add","inputs":[{"type":"minecraft:storage","storage":"math:","path":"internal.z"},-1]}
data modify storage math: internal.x set compute default float {"type":"minecraft:add","inputs":[{"type":"minecraft:storage","storage":"math:","path":"internal.z"},2]}
data modify storage math: internal.w_log_mantissa set compute default float {"type":"minecraft:mul","inputs":[0.25,{"type":"minecraft:storage","storage":"math:","path":"internal.x"}]}
data modify storage math: internal.w_log_reciprocal set compute default float math:.common/reciprocal/log_initial
data modify storage math: internal.w_log_reciprocal set compute default float math:.common/reciprocal/log_newton
data modify storage math: internal.w_log_reciprocal set compute default float math:.common/reciprocal/log_newton
data modify storage math: internal.w_log_reciprocal set compute default float math:.common/reciprocal/log_newton
data modify storage math: internal.x set compute default float {"type":"minecraft:mul","inputs":[0.25,{"type":"minecraft:storage","storage":"math:","path":"internal.w_log_reciprocal"}]}
data modify storage math: internal.z set compute default float math:log/normalize/u/00
return run data modify storage math: internal.x set compute default float math:log/00
