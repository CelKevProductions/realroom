"""CPU geometry/protocol tests only. No checkpoint or AI inference is simulated as real."""
import argparse
import hashlib
import io
import json
import pickle
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'services/furnishing/semlayout'))
from geometry import architecture, frame, pixel_to_world, world_to_pixel, decode_instance, instances
from assets import extract_checkpoint, verify_assets, REPOSITORY, UPSTREAM
from worker import ArgumentsUnpickler


def room():
    return {'polygon': [[10, 20], [14, 20], [14, 22], [12, 22], [12, 24], [10, 24]],
            'openings': [{'wall': 0, 'offset': 1, 'width': .8, 'type': 'door'},
                         {'wall': 1, 'offset': 1, 'width': 1.2, 'type': 'window'}], 'height': 2.7}


class GeometryTests(unittest.TestCase):
    def test_concavity_scale_and_openings(self):
        mask, transform = architecture(room())
        self.assertEqual(mask.shape, (120, 120))
        self.assertEqual(transform['center'], [12, 22])
        def at(x,z):
            col,row=world_to_pixel(x,z,transform)
            return mask[int(row),int(col)]
        self.assertEqual(at(11,23), 1)
        self.assertEqual(at(13,23), 0)  # Missing corner stays empty.
        self.assertEqual(at(11,20), 2)
        self.assertEqual(at(14,21), 3)
        # Four metres occupy 40 pixels, not the whole 120px canvas.
        self.assertAlmostEqual(world_to_pixel(14,22,transform)[0]-world_to_pixel(10,22,transform)[0],40)

    def test_translation_and_axis_convention(self):
        first, t = architecture(room())
        shifted=room(); shifted['polygon']=[[x-30,z+7] for x,z in shifted['polygon']]
        second, t2=architecture(shifted)
        np.testing.assert_array_equal(first,second)
        for x,z in [(11,20),(13,21),(10.312,23.321)]:
            self.assertTrue(np.allclose(pixel_to_world(*world_to_pixel(x,z,t),t),[x,z]))
        self.assertLess(world_to_pixel(12,23,t)[1],world_to_pixel(12,21,t)[1])
        self.assertEqual(t2['center'],[-18,29])

    def test_refuses_scaling_oversized_room(self):
        r=room();r['polygon']=[[0,0],[12,0],[12,3],[0,3]]
        with self.assertRaisesRegex(ValueError,'rescaling is forbidden'):frame(r)

    def test_rectangular_instance_decodes_all_quarter_turns(self):
        mask=np.zeros((120,120),bool);mask[40:50,70:90]=True
        t={'center':[12,22]}
        for orientation in range(4):
            obj=decode_instance(mask,t,orientation,[2,1,.8],.01)
            self.assertAlmostEqual(obj['x'],14)
            self.assertAlmostEqual(obj['z'],23.5)
            self.assertEqual(obj['size'],[1.,2.,.8] if orientation%2 else [2.,1.,.8])
            self.assertEqual(obj['rotation'],orientation*90)

    def test_architecture_is_never_decoded_as_furniture(self):
        semantic=np.zeros((120,120),int)
        semantic[10:30,10:30]=1;semantic[10:12,10:12]=36;semantic[12:14,10:12]=37
        semantic[15:19,15:19]=18;semantic[22:26,22:26]=18
        result=list(instances(semantic,{'18':'armchair'},{'armchair':.001}))
        self.assertEqual(len(result),2)
        self.assertTrue(all(category=='armchair' for _,category,_ in result))

    def test_invalid_apm_outputs_rejected(self):
        mask=np.ones((120,120),bool)
        for dimensions in [[1,-1,1],[1,float('nan'),1]]:
            with self.assertRaises(ValueError):decode_instance(mask,{'center':[0,0]},0,dimensions,0)


class AssetTests(unittest.TestCase):
    def test_vendor_sources_are_the_reviewed_commit(self):
        vendor=ROOT/'services/furnishing/semlayout/vendor'
        manifest=json.loads((vendor/'upstream.json').read_text())
        self.assertEqual(manifest['commit'],UPSTREAM)
        for file,digest in manifest['files'].items():
            self.assertEqual(hashlib.sha256((vendor/file).read_bytes()).hexdigest(),digest,file)

    def test_checkpoint_archive_only_copies_expected_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder=Path(tmp); archive=folder/'weights.tar.gz'
            with tarfile.open(archive,'w:gz') as tar:
                for name,data in [('nested/args.pickle',b'args'),('nested/check/checkpoint.pt',b'weights'),('../escape',b'no')]:
                    info=tarfile.TarInfo(name);info.size=len(data);tar.addfile(info,io.BytesIO(data))
            hashes=extract_checkpoint(archive,folder)
            self.assertEqual(set(hashes),{'args.pickle','sldn.pt'})
            self.assertFalse((folder/'escape').exists())
            (folder/'apm.ckpt').write_bytes(b'apm')
            hashes['apm.ckpt']=hashlib.sha256(b'apm').hexdigest()
            (folder/'manifest.json').write_text(json.dumps({'repository':REPOSITORY,'upstreamCommit':UPSTREAM,'files':hashes,'revision':'fixture'}))
            verify_assets(folder)
            (folder/'sldn.pt').write_bytes(b'changed')
            with self.assertRaisesRegex(ValueError,'integrity'):verify_assets(folder)

    def test_argument_pickle_only_accepts_namespace(self):
        value=ArgumentsUnpickler(io.BytesIO(pickle.dumps(argparse.Namespace(data_size=120)))).load()
        self.assertEqual(value.data_size,120)
        with self.assertRaises(pickle.UnpicklingError):ArgumentsUnpickler(io.BytesIO(pickle.dumps(Path('/tmp')))).load()


if __name__=='__main__':unittest.main()
