import importlib.util
import unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('apprendre',Path(__file__).resolve().parents[1]/'scripts/apprendre-ameublement.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class Analyse(unittest.TestCase):
    def test_premier_meuble_et_non_reference_dans_la_description(self):
        self.assertEqual(m.role('A bedside table beside a large bed'),'chevet')
        self.assertEqual(m.role('A bed with two nightstands'),'lit')
        self.assertEqual(m.role('A floor lamp near a sofa'),'lampadaire')
    def scene(self,quat):
        return {'room_type':'bedroom','scene':{'bounds_bottom':[[-2,0,-2],[2,0,-2],[2,0,2],[-2,0,2]],'objects':[{'desc':'A bed','size':[2,1,1],'pos':[0,0,0],'rot':quat},{'desc':'A nightstand','size':[.4,.5,.3],'pos':[1.5,0,1.5],'rot':[0,0,0,1]}]}}
    def test_quaternion_et_conversion_hauteur_profondeur(self):
        s,e=m.extraire(self.scene([0,.70710678,0,.70710678]));self.assertIsNone(e)
        lit=s['objets'][0];self.assertAlmostEqual(lit['h'],1);self.assertAlmostEqual(lit['d'],1)
        x0,z0,x1,z1=lit['boite'].bounds;self.assertAlmostEqual(x1-x0,1);self.assertAlmostEqual(z1-z0,2)
    def test_quaternions_antipodaux_identiques(self):
        a,_=m.extraire(self.scene([0,.70710678,0,.70710678]));b,_=m.extraire(self.scene([0,-.70710678,0,-.70710678]))
        self.assertAlmostEqual(a['objets'][0]['rot'],b['objets'][0]['rot'])
    def test_pas_de_reparation_silencieuse_des_objets_hors_contour(self):
        row=self.scene([0,0,0,1]);row['scene']['objects'][0]['pos']=[3,0,0]
        s,e=m.extraire(row);self.assertIsNone(s);self.assertEqual(e,'pas-assez-de-mobilier-valide')

if __name__=='__main__':unittest.main()
