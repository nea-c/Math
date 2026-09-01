data modify storage math: internal.w_inverse_trigonometry_input set from storage math: internal.x
execute if data storage math: {internal:{w_inverse_trigonometry_input:-1.0f}} run data modify storage math: internal.x set compute default float math:.common/inverse_trigonometry/pi
execute if data storage math: {internal:{w_inverse_trigonometry_input:-1.0f}} run return 1
execute if data storage math: {internal:{w_inverse_trigonometry_input:0.0f}} run data modify storage math: internal.x set compute default float math:.common/inverse_trigonometry/half_pi
execute if data storage math: {internal:{w_inverse_trigonometry_input:0.0f}} run return 1
execute if data storage math: {internal:{w_inverse_trigonometry_input:1.0f}} run data modify storage math: internal.x set value 0.0f
execute if data storage math: {internal:{w_inverse_trigonometry_input:1.0f}} run return 1
function math:.common/asin/0.start
data modify storage math: internal.w_inverse_trigonometry_half_pi set compute default float math:.common/inverse_trigonometry/half_pi
data modify storage math: internal.x set compute default float math:.common/inverse_trigonometry/acos
return 1
