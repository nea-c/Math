data modify storage math: internal.w_inverse_trigonometry_input set from storage math: internal.x
execute if data storage math: {internal:{w_inverse_trigonometry_input:-1.0f}} run return run data modify storage math: internal.x set compute default float {"type":"constant","value":3.1415927410125732}
execute if data storage math: {internal:{w_inverse_trigonometry_input:0.0f}} run return run data modify storage math: internal.x set compute default float math:.common/inverse_trigonometry/half_pi
execute if data storage math: {internal:{w_inverse_trigonometry_input:1.0f}} run return run data modify storage math: internal.x set value 0.0f
function math:.common/asin/0.start
data modify storage math: internal.w_inverse_trigonometry_half_pi set compute default float math:.common/inverse_trigonometry/half_pi
return run data modify storage math: internal.x set compute default float math:.common/inverse_trigonometry/acos
